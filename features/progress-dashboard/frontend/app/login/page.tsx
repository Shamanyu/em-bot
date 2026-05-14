'use client';

import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: 'google' | 'github') {
    setLoading(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">EM Dashboard</h1>
          <p className="text-zinc-400 text-sm">
            Daily engineering progress, powered by your JIRA data.
          </p>
        </div>

        {/* Prerequisites */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            What you&apos;ll need before signing up
          </p>
          <div className="space-y-4">
            <Prereq
              icon="🔑"
              title="JIRA API Token"
              description={
                <>
                  Create one at{' '}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    id.atlassian.com → Security → API tokens
                  </a>
                  . You&apos;ll also need your JIRA instance URL (e.g.{' '}
                  <code className="bg-zinc-800 px-1 rounded text-xs text-zinc-300">
                    acme.atlassian.net
                  </code>
                  ) and your Atlassian email.
                </>
              }
            />
            <Prereq
              icon="🤖"
              title="Anthropic API Key"
              description={
                <>
                  Get one at{' '}
                  <a
                    href="https://console.anthropic.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    console.anthropic.com/keys
                  </a>
                  . Each daily run costs roughly $0.10–0.20 in API credits.
                </>
              }
            />
            <Prereq
              icon="📋"
              title="JIRA Project Keys"
              description="The short prefixes for the projects you want to track — e.g. CM, XPS, SP. Found in your JIRA project URLs."
            />
          </div>
        </div>

        {/* Sign in */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Sign in to get started
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => signIn('google')}
              disabled={loading !== null}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <button
              onClick={() => signIn('github')}
              disabled={loading !== null}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-zinc-700 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitHubIcon />
              {loading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}

          <p className="mt-5 text-xs text-zinc-600 text-center">
            Your JIRA and Anthropic credentials are encrypted at rest and never exposed to the browser.
          </p>
        </div>

      </div>
    </div>
  );
}

function Prereq({ icon, title, description }: { icon: string; title: string; description: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 text-lg leading-none mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-zinc-200 mb-0.5">{title}</p>
        <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 fill-zinc-200" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
