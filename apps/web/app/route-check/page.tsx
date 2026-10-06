import Link from 'next/link';
export default function RouteCheck() { return <main className="route-check"><h1>Route departure check</h1><p>The persistent world shell remains mounted. The content controller must be disposed while this route is active.</p><Link href="/" prefetch={false}>Return to articles</Link></main>; }
