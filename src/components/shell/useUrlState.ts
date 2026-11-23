import { useEffect } from "react";
import { EMPTY_FILTER } from "../../domain/filter";
import { filterFromSearch, filterToSearch } from "../../domain/filterUrl";
import { useUi, VIEWS } from "../../state/ui";

/** Keeps the screen and the library filters in the URL, so a reload or a shared link lands in the same place. */
export function useUrlState() {
  useEffect(() => {
    const { view, filter } = filterFromSearch(window.location.search, VIEWS);
    if (view || filterToSearch("library", filter)) useUi.setState({ view: view ?? "library", filter });

    const write = (s: ReturnType<typeof useUi.getState>) => {
      const browsing = s.view === "library" || s.view === "installed";
      const search = filterToSearch(s.view, browsing ? s.filter : EMPTY_FILTER);
      if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
    };
    return useUi.subscribe((s, prev) => { if (s.view !== prev.view || s.filter !== prev.filter) write(s); });
  }, []);
}
