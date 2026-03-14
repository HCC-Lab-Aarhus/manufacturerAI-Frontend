export interface OutlineVertex {
	x: number
	y: number
	ease_in?: number
	ease_out?: number
	z_top?: number | null
	z_bottom?: number | null
}

export interface Outline {
	points: OutlineVertex[]
}

export interface TopSurface {
	type: 'flat' | 'dome' | 'ridge'
	peak_x_mm?: number | null
	peak_y_mm?: number | null
	peak_height_mm?: number | null
	base_height_mm?: number | null
	x1?: number | null
	y1?: number | null
	x2?: number | null
	y2?: number | null
	crest_height_mm?: number | null
	falloff_mm?: number | null
}

export interface BottomSurface {
	type: 'flat' | 'dome' | 'ridge'
	peak_x_mm?: number | null
	peak_y_mm?: number | null
	peak_height_mm?: number | null
	base_height_mm?: number | null
	x1?: number | null
	y1?: number | null
	x2?: number | null
	y2?: number | null
	crest_height_mm?: number | null
	falloff_mm?: number | null
}

export interface EdgeProfile {
	type: 'none' | 'chamfer' | 'fillet'
	size_mm: number
}

export interface Enclosure {
	height_mm: number
	top_surface?: TopSurface | null
	bottom_surface?: BottomSurface | null
	edge_top?: EdgeProfile
	edge_bottom?: EdgeProfile
}

export interface UIPlacement {
	instance_id: string
	catalog_id: string
	x_mm: number
	y_mm: number
	edge_index?: number | null
	conform_to_surface?: boolean
}

export interface ComponentInstance {
	catalog_id: string
	instance_id: string
	config?: Record<string, unknown> | null
	mounting_style?: string | null
}

export interface Net {
	id: string
	pins: string[]
}

export interface DesignSpec {
	outline: Outline
	enclosure: Enclosure
	ui_placements: UIPlacement[]
	components?: ComponentInstance[]
	nets?: Net[]
}

export interface CircuitSpec {
	components: ComponentInstance[]
	nets: Net[]
}

export interface PinPosition {
	[pinId: string]: [number, number]
}

export interface PlacedComponent {
	catalog_id: string
	instance_id: string
	x_mm: number
	y_mm: number
	rotation_deg?: number
	pin_positions: PinPosition
	body?: CatalogBody
	pins?: CatalogPin[]
	mounting_style?: string
}

export interface PlacementResult {
	outline: Outline
	enclosure: Enclosure
	components: PlacedComponent[]
	nets: Net[]
	height_grid?: number[][]
	bottom_height_grid?: number[][]
	pcb_contour?: [number, number][]
}

export interface Trace {
	net_id: string
	path: [number, number][]
}

export interface RoutingResult {
	traces: Trace[]
	trace_width_mm: number
	outline: Outline
	enclosure: Enclosure
	components: PlacedComponent[]
	nets: Net[]
	pcb_contour?: [number, number][]
}

export interface BitmapResult {
	bitmap_b64: string
	bitmap_cols: number
	bitmap_rows: number
	bed_width: number
	bed_depth: number
	bed_offset_x: number
	bed_offset_y: number
	outline: Outline
	components: PlacedComponent[]
	traces: Trace[]
	trace_width_mm: number
}

export type PipelineStage = 'design' | 'circuit' | 'manufacture'

export type ManufactureStep = 'placement' | 'routing' | 'bitmap' | 'scad' | 'compile' | 'gcode'

export type StageStatus = 'pending' | 'complete' | 'done' | 'error'

export type PipelineState = Record<string, StageStatus | string>

export interface SessionMeta {
	id: string
	created: string
	last_modified: string
	description?: string
	name?: string
	printer_id?: string
	pipeline_state: PipelineState
	artifacts: Record<string, boolean>
}

export interface Printer {
	id: string
	label: string
	bed_width: number
	bed_depth: number
	nominal_bed_width: number
	nominal_bed_depth: number
	inkjet_offset_x: number
	inkjet_offset_y: number
	max_z_mm: number
}

export interface Filament {
	id: string
	label: string
}

export interface CatalogBody {
	shape: 'rect' | 'circle'
	height_mm: number
	width_mm?: number
	length_mm?: number
	diameter_mm?: number
}

export interface PinShape {
	type: string
	width_mm?: number
	length_mm?: number
}

export interface CatalogPin {
	id: string
	label: string
	position_mm: [number, number]
	direction: 'in' | 'out' | 'bidirectional'
	hole_diameter_mm: number
	description: string
	voltage_v?: number | null
	current_max_ma?: number | null
	shape?: PinShape | null
}

export interface PinGroup {
	id: string
	pin_ids: string[]
	description?: string
	fixed_net?: string | null
	allocatable?: boolean
	capabilities?: string[] | null
}

export interface Mounting {
	style: string
	allowed_styles: string[]
	blocks_routing: boolean
	keepout_margin_mm: number
}

export interface CatalogComponent {
	id: string
	name: string
	description: string
	ui_placement: boolean
	body: CatalogBody
	mounting: Mounting
	pins: CatalogPin[]
	internal_nets?: string[][]
	pin_groups?: PinGroup[] | null
	configurable?: Record<string, unknown> | null
	source_file?: string
}

export interface Catalog {
	components: CatalogComponent[]
	validation_errors?: string[]
}

export interface ConversationMessage {
	role: 'user' | 'assistant'
	content: string | ConversationContentBlock[]
}

export interface ConversationContentBlock {
	type: 'text' | 'thinking' | 'tool_use' | 'tool_result'
	text?: string
	thinking?: string
	name?: string
	input?: Record<string, unknown>
	content?: string
	is_error?: boolean
}

export interface ScadResult {
	status: 'done' | 'error'
	scad?: string
	scad_lines?: number
	scad_bytes?: number
}

export interface CompileStatus {
	status: 'pending' | 'compiling' | 'done' | 'error'
	message?: string
	stl_bytes?: number
}

export interface GCodeStatus {
	status: 'pending' | 'running' | 'done' | 'error'
	message?: string
	stages?: GCodeStageInfo[]
	has_bgcode?: boolean
	gcode_bytes?: number
}

export interface GCodeStageInfo {
	name: string
	status: string
	message?: string
}

export interface TokenUsage {
	input_tokens: number
	budget: number
}

export interface PlacementValidation {
	valid: boolean
	errors: string[]
}
