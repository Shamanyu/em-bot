interface Props {
  onNext: () => void;
}

export function Prerequisites({ onNext }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Before you start</h2>
      <p className="text-gray-500 text-sm mb-8">
        Gather these three things — setup takes about 5 minutes once you have them.
      </p>

      <div className="space-y-4 mb-10">
        <Prereq
          number="1"
          title="JIRA API Token"
          description={
            <>
              Go to{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                id.atlassian.com → Security → API tokens
              </a>{' '}
              and create a new token. You&apos;ll also need your JIRA instance URL
              (e.g.{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">
                https://acme.atlassian.net
              </code>
              ) and the email address on your Atlassian account.
            </>
          }
        />
        <Prereq
          number="2"
          title="Anthropic API Key"
          description={
            <>
              Available at{' '}
              <a
                href="https://console.anthropic.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                console.anthropic.com/keys
              </a>
              . You need an Anthropic account with at least a small credit balance —
              each daily run costs roughly $0.10–0.20.
            </>
          }
        />
        <Prereq
          number="3"
          title="JIRA Project Keys"
          description="The short identifiers for the projects you want to track — the prefix before issue numbers (e.g. CM in CM-123, XPS in XPS-456). You can find them in your JIRA project URLs."
        />
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
      >
        I have everything — let&apos;s go →
      </button>
    </div>
  );
}

function Prereq({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 p-4 bg-gray-50 rounded-xl">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
        {number}
      </span>
      <div>
        <p className="font-medium text-gray-900 text-sm mb-1">{title}</p>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
