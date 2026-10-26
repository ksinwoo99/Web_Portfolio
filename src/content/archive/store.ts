import { create } from "zustand";

/*
 * 지금 열려 있는 자료실 문서. 책장 팝업(고르기)과 게임창 아래 자료실 페이지(열람)가 함께 쓴다 —
 * 팝업에서 고르면 팝업은 닫히고 문서는 페이지 쪽에서 넓게 열린다.
 */
type ArchiveState = {
  openId: string | null;
  seq: number; // 같은 문서를 다시 골라도 그 자리로 스크롤하도록 열 때마다 증가
  open: (id: string) => void;
  close: () => void;
};

export const useArchiveStore = create<ArchiveState>()((set) => ({
  openId: null,
  seq: 0,
  open: (id) => set((s) => ({ openId: id, seq: s.seq + 1 })),
  close: () => set({ openId: null }),
}));
