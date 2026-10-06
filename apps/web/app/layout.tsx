import type { ReactNode } from 'react';
import PersistentMotionShell from '../components/PersistentMotionShell';
import { worldHTML } from '../lib/server/world-html';
import '../runtime/style.css';
import '../runtime/material.css';
import '../runtime/world/scoped.css';
import '../runtime/palette.css';
import '../runtime/host.css';
import '../runtime/feed-compact.css';
import '../runtime/story/story.css';
import '../runtime/modules/menu.css';
import '../runtime/modules/weather.css';
import '../runtime/chat/contextual-chat.css';
import '../runtime/chat-host.css';
import '../runtime/chat/chat-mobile-flow.css';
import '../styles/migration.css';
export default function RootLayout({children}: {children: ReactNode}) {
  return <html lang="zh-CN" data-story-enabled="false"><body className="living-study" data-entry="home"><PersistentMotionShell worldHTML={worldHTML}>{children}</PersistentMotionShell></body></html>;
}
