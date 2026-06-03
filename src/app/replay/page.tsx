import { requireUser } from "@/lib/auth/require-user";
import { listReplayDatasets } from "@/lib/db/repositories";
import { ReplayLab } from "./replay-lab";

export default async function ReplayPage() {
  const user = await requireUser();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Replay lab</p>
          <h1>Test rules against moving candles.</h1>
          <p className="subhead">
            Paste ChatGPT-generated or prior-day one-minute candles, save them
            locally, then replay them through your active rules as accelerated
            market activity.
          </p>
        </div>
      </div>
      <ReplayLab initialDatasets={listReplayDatasets(user.id)} />
    </div>
  );
}
