import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const WS_URL = 'ws://localhost:1234';

export const useCollaboration = (updateElementsAndHistory, currentState) => {
    const [isConnected, setIsConnected] = useState(false);
    const [collabRoomId, setCollabRoomId] = useState(null);
    const [remoteCursors, setRemoteCursors] = useState({});
    
    const ydocRef = useRef(new Y.Doc());
    const providerRef = useRef(null);
    const awarenessRef = useRef(null);

    // Parse room ID from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const room = params.get('room');

        if (room) {
            setCollabRoomId(room);
        }
    }, []);

    // Connect to Yjs provider when room ID is set
    useEffect(() => {
        if (!collabRoomId) return;

        const ydoc = ydocRef.current;
        const provider = new WebsocketProvider(WS_URL, collabRoomId, ydoc);
        providerRef.current = provider;
        awarenessRef.current = provider.awareness;

        const elementsMap = ydoc.getMap('elements');
        
        provider.on('status', event => {
            setIsConnected(event.status === 'connected');
        });

        // Sync local state when Yjs updates
        elementsMap.observe(event => {
            const newElements = Array.from(elementsMap.values());
            
            // We use a special flag or check to avoid infinite loops if we were 
            // the ones who updated it. But simpler is to just sync.
            // Note: This pushes to history stack in App.js which might be heavy.
            // Ideally we should update 'current' state without history push for remote changes.
            // For now, we reuse the existing updater.
            if (!event.transaction.local) {
                updateElementsAndHistory(() => newElements);
            }
        });

        // Awareness (Cursors)
        provider.awareness.on('change', () => {
            const states = provider.awareness.getStates();
            const cursors = {};
            states.forEach((state, clientId) => {
                if (clientId !== provider.awareness.clientID && state.cursor) {
                    cursors[clientId] = state.cursor;
                }
            });
            setRemoteCursors(cursors);
        });

        return () => {
            provider.disconnect();
            provider.destroy();
        };
    }, [collabRoomId, updateElementsAndHistory]);

    // Initial Sync: If we have elements and join a room, we might want to populate it?
    // Or if the room has elements, we adopt them.
    // Yjs handles this via sync. If room is empty, we keep ours? 
    // Actually Yjs starts empty. If we have local elements, we should push them to Yjs?
    // This is tricky: merging local 'offline' work with remote.
    // Simple approach: When joining, if Yjs is empty, push local elements.
    useEffect(() => {
        if (isConnected && collabRoomId) {
            const ydoc = ydocRef.current;
            const elementsMap = ydoc.getMap('elements');
            
            if (elementsMap.size === 0 && currentState.length > 0) {
                ydoc.transact(() => {
                    currentState.forEach(el => {
                        elementsMap.set(el.id.toString(), el);
                    });
                });
            }
        }
    }, [isConnected, collabRoomId, currentState]);

    const emitDraw = useCallback((element) => {
        if (!collabRoomId || !ydocRef.current) return;
        
        const elementsMap = ydocRef.current.getMap('elements');
        elementsMap.set(element.id.toString(), element);
    }, [collabRoomId]);

    const emitUpdate = useCallback((element) => {
        if (!collabRoomId || !ydocRef.current) return;
        
        const elementsMap = ydocRef.current.getMap('elements');
        elementsMap.set(element.id.toString(), element);
    }, [collabRoomId]);

    const emitDelete = useCallback((elementIds) => {
        if (!collabRoomId || !ydocRef.current) return;
        
        const elementsMap = ydocRef.current.getMap('elements');
        ydocRef.current.transact(() => {
            elementIds.forEach(id => {
                elementsMap.delete(id.toString());
            });
        });
    }, [collabRoomId]);

    const emitClear = useCallback(() => {
        if (!collabRoomId || !ydocRef.current) return;
        
        const elementsMap = ydocRef.current.getMap('elements');
        ydocRef.current.transact(() => {
            const keys = Array.from(elementsMap.keys());
            keys.forEach(key => elementsMap.delete(key));
        });
    }, [collabRoomId]);

    const emitCursorMove = useCallback((x, y, userColor) => {
        if (!collabRoomId || !awarenessRef.current) return;
        
        awarenessRef.current.setLocalStateField('cursor', {
            x, y, color: userColor
        });
    }, [collabRoomId]);

    return {
        isConnected,
        collabRoomId,
        setCollabRoomId,
        emitDraw,
        emitUpdate,
        emitDelete,
        emitClear,
        emitCursorMove,
        remoteCursors
    };
};
