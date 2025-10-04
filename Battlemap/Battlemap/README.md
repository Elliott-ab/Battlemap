# Battlemap

A lightweight battlemap built with React + Vite. Supports tokens, cover blocks, initiative, and movement highlighting on a square grid.

## Movement and terrain

- Grid size: configurable in ft-per-cell from the Gear icon.
- Normal movement cost: 1 cell costs gridSize feet (e.g., 5 ft).
- Difficult terrain: add cover with type "Difficult Terrain" in the editor. These cells are passable but cost double movement (2 cells of cost) when entered.
	- Example: with a 5 ft grid, entering a difficult cell costs 10 ft.
	- Normal cover types (Half/Three-Quarters/Full) are impassable to movement.
- Movement range: highlights use weighted reachability (Dijkstra). Difficult cells count as 2, normal as 1. Click any highlighted cell to move.

Notes:
- Diagonal movement is not currently supported; moves are orthogonal (up/down/left/right).
- Enemy facing can be set by clicking a destination cell during their turn; difficult terrain rules do not affect facing.
