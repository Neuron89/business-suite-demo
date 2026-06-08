'use client';

/**
 * Microsoft Clarity loader.
 *
 * Heatmaps, click maps, session recordings — free and tenant-scoped to
 * the NYCOA M365 org. The project ID comes from clarity.microsoft.com
 * after creating a project. Wire it via NEXT_PUBLIC_CLARITY_PROJECT_ID
 * in the app's .env.local (or .env in production).
 *
 * No-ops when the env var is unset — local dev / CI / un-configured
 * deployments stay clean and never call out to Microsoft.
 *
 * Drop this once into the root layout, alongside the theme/auth providers.
 */
import Script from 'next/script';

export default function ClarityScript() {
  const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!id) return null;
  // The official Clarity snippet, parameterized.
  return (
    <Script id="clarity-init" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
