/**
 * Where the map's squares come from. A build sets its own with
 * `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION`, so a self-hosted server
 * chooses its host. Without them, OpenStreetMap's.
 *
 * The reader's browser asks the tile host for the squares it shows, which
 * tells that host roughly where the reader is looking. No recorded position is
 * sent to it.
 */
const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export const MAP_TILES = {
  url: import.meta.env.VITE_MAP_TILE_URL || DEFAULT_TILE_URL,
  attribution:
    import.meta.env.VITE_MAP_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION,
}
