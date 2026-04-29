// Re-export from the context module for backwards compatibility.
// New code should import from "@/context/FavoritesContext" directly and prefer
// useIsFavorite(id) + useToggleFavorite() in hot paths (e.g. ProductCard).
export {
  useFavorites,
  useIsFavorite,
  useToggleFavorite,
  FavoritesProvider,
} from "@/context/FavoritesContext";
