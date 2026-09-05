/**
 * Curated Lucide icons for services and the site brand. A subset keeps the
 * bundle small — the full set is ~1500 icons. Stored in the DB by name.
 */
import {
	Activity,
	Bell,
	Box,
	Cloud,
	Code,
	Cpu,
	CreditCard,
	Database,
	FileText,
	Gauge,
	GitBranch,
	Globe,
	HardDrive,
	Image,
	Key,
	Layers,
	Lock,
	Mail,
	MessageSquare,
	Monitor,
	Network,
	Phone,
	Radio,
	Rss,
	Search,
	Server,
	Shield,
	ShoppingCart,
	Smartphone,
	Terminal,
	Timer,
	Webhook,
	Wifi,
	Workflow,
	Wrench,
	Zap
} from '@lucide/svelte';
import type { Component } from 'svelte';

export const ICONS = {
	activity: Activity,
	bell: Bell,
	box: Box,
	cloud: Cloud,
	code: Code,
	cpu: Cpu,
	'credit-card': CreditCard,
	database: Database,
	'file-text': FileText,
	gauge: Gauge,
	'git-branch': GitBranch,
	globe: Globe,
	'hard-drive': HardDrive,
	image: Image,
	key: Key,
	layers: Layers,
	lock: Lock,
	mail: Mail,
	'message-square': MessageSquare,
	monitor: Monitor,
	network: Network,
	phone: Phone,
	radio: Radio,
	rss: Rss,
	search: Search,
	server: Server,
	shield: Shield,
	'shopping-cart': ShoppingCart,
	smartphone: Smartphone,
	terminal: Terminal,
	timer: Timer,
	webhook: Webhook,
	wifi: Wifi,
	workflow: Workflow,
	wrench: Wrench,
	zap: Zap
} satisfies Record<string, Component>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(value: unknown): value is IconName {
	return typeof value === 'string' && value in ICONS;
}
