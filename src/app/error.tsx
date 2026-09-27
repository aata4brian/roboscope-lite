'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="missing-incident" role="alert"><h1>Unable to render this view</h1><p>Your saved recording stays in this browser. Try loading the view again.</p><button className="button primary" onClick={reset}>Try again</button></div>;}
