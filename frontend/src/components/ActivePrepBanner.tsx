import { Briefcase, X, RefreshCw } from 'lucide-react'
import { useActivePrepJob } from '../hooks/useActivePrepJob'

interface ActivePrepBannerProps {
  /** Show a "Switch job" link — useful on pages where job context matters */
  showSwitch?: boolean
}

/**
 * Compact banner shown at the top of all MVP2 tool pages
 * when the user has an active prep job set.
 */
export function ActivePrepBanner({ showSwitch = false }: ActivePrepBannerProps) {
  const { activePrep, clearPrep, isClearingPrep } = useActivePrepJob()

  if (!activePrep) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-sm mb-4">
      <Briefcase className="h-4 w-4 text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-indigo-300 font-medium">Prepping for:</span>
        <span className="text-white font-semibold ml-1.5 truncate">
          {activePrep.job_title}
        </span>
        <span className="text-slate-400 ml-1">@ {activePrep.company_name}</span>
        {activePrep.skill_gap_pct > 0 && (
          <span className="ml-3 text-amber-400 text-xs">
            {activePrep.skill_gap_pct}% skill gap
          </span>
        )}
        {activePrep.skill_gap_pct === 0 && (
          <span className="ml-3 text-emerald-400 text-xs">
            ✓ Full skill match
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showSwitch && (
          <a
            href="/app/jobs"
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Switch job
          </a>
        )}
        <button
          onClick={() => clearPrep()}
          disabled={isClearingPrep}
          className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          title="Clear active prep job"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
