export const initialState = {
  elements: [],
  initiativeOrder: [],
  currentTurnIndex: 0,
  initiativeScores: {}, // { [elementId]: number }
  grid: {
    width: 20,
    height: 20,
    cellSize: 5,
  },
};