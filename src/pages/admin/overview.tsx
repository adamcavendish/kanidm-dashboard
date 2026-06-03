import { AppWindow, BadgeCheck, GitBranch, Palette, Plus, UsersRound } from "lucide-solid";
import { intentionallyExcludedSurfaces, supportedAdminSurfaces } from "../../domain";
import { useConsole } from "../../store";
import Checklist from "../../components/checklist";
import GlassPanel from "../../components/glass-panel";
import PageHeader from "../../components/page-header";
import { StatCard } from "../../components/stat-card";
import { Link } from "../../routing";
export function AdminOverviewPage() {
  const { state, apiStatus, config } = useConsole();
  const activePeople = () => state().people.filter((person) => person.status === "active").length;
  const appsReady = () => state().apps.filter((app) => app.status === "ready").length;

  return (
    <>
      <PageHeader
        eyebrow="Admin console"
        title="Operations overview"
        action={
          <Link class="primary-action" href="/admin/apps/new">
            <Plus size={16} /> Add application
          </Link>
        }
      />
      <div class="status-line">
        <BadgeCheck size={16} />
        <span>
          Data source: <strong>{apiStatus().mode}</strong> · {apiStatus().message}
        </span>
      </div>
      <div class="stat-grid">
        <StatCard
          icon={<UsersRound />}
          label="People"
          value={state().people.length}
          detail={`${activePeople()} active`}
        />
        <StatCard
          icon={<GitBranch />}
          label="Groups"
          value={state().groups.length}
          detail="Membership-backed access"
        />
        <StatCard
          icon={<AppWindow />}
          label="Applications"
          value={state().apps.length}
          detail={`${appsReady()} ready`}
        />
        <StatCard
          icon={<Palette />}
          label="Theme"
          value={config().theme.preset}
          detail={config().theme.mode}
        />
      </div>
      <div class="admin-overview-panels">
        <div class="two-column">
          <GlassPanel title="Supported Kanidm surfaces">
            <Checklist items={supportedAdminSurfaces} />
          </GlassPanel>
          <GlassPanel title="Excluded from this console">
            <Checklist items={intentionallyExcludedSurfaces} muted />
          </GlassPanel>
        </div>
        <GlassPanel title="Recent access changes">
          <p class="muted panel-copy">
            Access audit logging is not available in this dashboard release.
          </p>
        </GlassPanel>
      </div>
    </>
  );
}

