import { useEffect } from "react";
import { roomFromHash, useGameStore } from "../store";

// 방 = 라우트(#/room/works). 새로고침 시 위치 유지, 특정 방 링크 공유를 위해.
export function useHashSync() {
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.room === prev.room) return;
      const hash = "#/room/" + s.room;
      if (location.hash !== hash) location.hash = hash;
    });
    const onHashChange = () => {
      const room = roomFromHash(location.hash);
      if (room && room !== useGameStore.getState().room) useGameStore.getState().enterRoom(room);
    };
    addEventListener("hashchange", onHashChange);
    return () => {
      unsubscribe();
      removeEventListener("hashchange", onHashChange);
    };
  }, []);
}
