import type { ComponentType } from "react";
import type { RoomId } from "../../game/rooms";
import LobbyPage from "./LobbyPage";
import PyFactoryPage from "./PyFactoryPage";
import RoguelikePage from "./RoguelikePage";
import EvolutionPage from "./EvolutionPage";
import ArchivePage from "./ArchivePage";

// 게임창 아래에 보이는 방별 소개 페이지. rooms.ts와 분리해 둔 건 LobbyPage가 ROOMS를 읽어서 순환 import가 생기기 때문.
export const ROOM_PAGES: Record<RoomId, ComponentType> = {
  lobby: LobbyPage,
  pyfactory: PyFactoryPage,
  roguelike: RoguelikePage,
  evolution: EvolutionPage,
  archive: ArchivePage,
};
