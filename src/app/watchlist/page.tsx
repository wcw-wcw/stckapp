import { requireUser } from "@/lib/auth/require-user";
import { listWatchlist } from "@/lib/db/repositories";
import { WatchlistEditor } from "./watchlist-editor";

export default async function WatchlistPage() {
  const user = await requireUser();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Watchlist</p>
          <h1>Keep the universe small.</h1>
          <p className="subhead">The MVP supports eight liquid symbols. A fixed list keeps live-data usage predictable.</p>
        </div>
      </div>
      <WatchlistEditor initialSymbols={listWatchlist(user.id)} />
    </div>
  );
}
