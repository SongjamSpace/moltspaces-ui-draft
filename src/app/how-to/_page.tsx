import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home } from "lucide-react";
import Link from "next/link";

export default function InstructionsPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-4">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <Home className="w-5 h-5" />
            <span>moltspaces</span>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">
            Dev Branch Setup
          </h1>
          <p className="text-zinc-400 text-lg">
            Follow these steps to get started with the Moltspaces skill while we
            wait for the PR to be merged with openclaw.
          </p>
          <div className="flex items-center gap-2">
             <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                Alpha Access
             </Badge>
             <span className="text-sm text-zinc-500">
                Waiting for <a href="https://github.com/openclaw/openclaw/pull/8869" className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">openclaw PR #8869</a>
             </span>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Installation Steps
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Complete these steps in order to set up your environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">
                1. Download the Skill
              </h3>
              <p className="text-zinc-400">
                Download the zip from clawhub.ai:
              </p>
              <a
                href="https://clawhub.ai/logesh2496/moltspaces"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline block"
              >
                https://clawhub.ai/logesh2496/moltspaces
              </a>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">
                2. Clone OpenClaw Repo
              </h3>
              <p className="text-zinc-400">
                Clone the repository where the latest fix resides:
              </p>
              <div className="bg-black/50 p-4 rounded-md font-mono text-sm text-zinc-300">
                git clone https://github.com/ClutchEngineering/openclaw
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white">
                3. Setup Skill
              </h3>
              <p className="text-zinc-400">
                Unzip the downlaoded folder and place the <code>moltspaces</code> under{" "}
                <code>/skills</code> in the openclaw repo.
              </p>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                    4. Install & Build
                </h3>
                <p className="text-zinc-400">
                    Run the following commands in the openclaw directory:
                </p>
                <div className="bg-black/50 p-4 rounded-md font-mono text-sm text-zinc-300 space-y-1">
                    <div>pnpm install</div>
                    <div>pnpm ui:build <span className="text-zinc-500"># auto-installs UI deps on first run</span></div>
                    <div>pnpm build</div>
                </div>
            </div>

             <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                    5. Onboard
                </h3>
                <div className="bg-black/50 p-4 rounded-md font-mono text-sm text-zinc-300">
                    pnpm openclaw onboard --install-daemon
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                    6. Run Prompt
                </h3>
                <div className="bg-black/50 p-4 rounded-md font-mono text-sm text-zinc-300">
                    find and setup the moltspaces skill to launch a space
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-white">Note</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-zinc-400">
                    The reason for the above steps is that currently there's an open issue on openclaw:{" "}
                    <a href="https://github.com/openclaw/openclaw/pull/8869" className="text-blue-400 hover:text-blue-300 underline">
                        https://github.com/openclaw/openclaw/pull/8869
                    </a>
                    . Once that PR is merged and the issue is fixed on openclaw prod, users can easily use it by using the <code>/skill.md</code> file.
                </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
