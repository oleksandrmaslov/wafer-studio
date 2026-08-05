import { PropsWithChildren } from "react";

import { ExternalLink as LinkIcon } from "lucide-react";

export interface ExternalLinkProps {
  href: string;
}

export const ExternalLink = ({
  href,
  children,
}: PropsWithChildren<ExternalLinkProps>) => {
  return (
    <a className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-current" target="_new" href={href}>
      {children}
      <LinkIcon className="inline-block w-4 mx-1 align-text-top" />
    </a>
  );
};
