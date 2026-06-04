import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { listRules } from "@/lib/db/repositories";
import { QuickPriceAlert } from "./quick-price-alert";
import { RuleManager } from "./rule-manager";

export default async function RulesPage() {
  const user = await requireUser();
  const rules = await listRules(user.id);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rule management</p>
          <h1>Keep only useful signals.</h1>
          <p className="subhead">Pause a rule without losing it, or permanently delete definitions you no longer need.</p>
        </div>
        <Link className="button" href="/rules/new">Create rule</Link>
      </div>
      <div className="grid split-grid">
        <QuickPriceAlert />
        <RuleManager initialRules={rules} />
      </div>
    </div>
  );
}
