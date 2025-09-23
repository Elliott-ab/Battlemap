export const initialState = {
  elements: [],
  initiativeOrder: [],
  currentTurnIndex: 0,
  initiativeScores: {}, // { [elementId]: number }
  globalModifiers: [], // [{ id, name, category: 'movement'|'hp', applyToPlayers: boolean, applyToEnemies: boolean, enabled: boolean, magnitude: string, magnitudeMode: 'plus'|'minus'|'percent' }]
  grid: {
    width: 20,
    height: 20,
    cellSize: 5,
  },
};