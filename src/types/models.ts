export interface OutlineVertex {
	x: number
	y: number
	ease_in?: number
	ease_out?: number
	z_top?: number | null
	z_bottom?: number | null
}

export type Outline = OutlineVertex[] | { points: OutlineVertex[]; holes?: OutlineVertex[][] }

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
	enclosure_style?: 'solid' | 'two_part'
	split_z_mm?: number | null
}

export interface UIPlacement {
	instance_id: string
	catalog_id: string
	x_mm: number
	y_mm: number
	edge_index?: number | null
	conform_to_surface?: boolean
	button_outline?: [number, number][] | null
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
	device_description?: string
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

export interface HeightGrid {
	origin_x: number
	origin_y: number
	step_mm: number
	rows: number
	cols: number
	grid: (number | null)[][]
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
	ui_placement?: boolean
	cap_diameter_mm?: number
	cap_clearance_mm?: number
}

export interface PlacementResult {
	outline: Outline
	enclosure: Enclosure
	components: PlacedComponent[]
	nets: Net[]
	height_grid?: HeightGrid | null
	bottom_height_grid?: HeightGrid | null
	pcb_contour?: [number, number][]
}

export interface Trace {
	net_id: string
	path: [number, number][]
}

export interface InflatedTrace {
	net_id: string
	centreline: [number, number][]
	polygon: [number, number][]
	holes?: [number, number][][]
}

export interface JumperEndpoint {
	x: number
	y: number
	pin_center?: [number, number] | null
	pin_radius_mm?: number
}

export interface JumperWire {
	net_id: string
	start: JumperEndpoint | [number, number]
	end: JumperEndpoint | [number, number]
	length_mm: number
}

export interface RoutingResult {
	traces: Trace[]
	inflated_traces?: InflatedTrace[]
	trace_width_mm: number
	pin_clearance_mm?: number
	outline: Outline
	enclosure: Enclosure
	components: PlacedComponent[]
	nets: Net[]
	failed_nets?: string[]
	jumpers?: JumperWire[]
	pcb_contour?: [number, number][]
}

export interface BitmapResult {
	bitmap_b64: string
	bitmap_cols: number
	bitmap_rows: number
	bed_width: number
	bed_depth: number
	nominal_bed_width: number
	nominal_bed_depth: number
	keepout_left: number
	keepout_right: number
	keepout_front: number
	keepout_back: number
	bed_offset_x: number
	bed_offset_y: number
	outline: Outline
	components: PlacedComponent[]
	traces: Trace[]
	trace_width_mm: number
	pin_clearance_mm?: number
}

export type PipelineStage = 'design' | 'circuit' | 'manufacture' | 'guide' | 'setup'

export type ManufactureStep = 'placement' | 'routing' | 'inflation' | 'bitmap' | 'scad' | 'compile' | 'gcode'

export type StageStatus = 'pending' | 'complete' | 'error'

export type PipelineState = Record<string, StageStatus | string>

export interface PipelineError {
	error: string
	reason: string
	responsible_agent?: 'design' | 'circuit'
}

export interface SessionMeta {
	id: string
	created: string
	last_modified: string
	description?: string
	name?: string
	printer_id?: string
	filament_id?: string
	model_id?: string
	pipeline_state: PipelineState
	pipeline_errors?: Record<string, PipelineError>
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

export interface ModelOption {
	id: string
	label: string
	api_model: string
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

export interface MountingCap {
	diameter_mm: number
	height_mm: number
	hole_clearance_mm: number
}

export interface MountingHatch {
	enabled: boolean
	clearance_mm: number
	thickness_mm: number
}

export interface Mounting {
	style: string
	allowed_styles: string[]
	blocks_routing: boolean
	keepout_margin_mm: number
	cap?: MountingCap | null
	hatch?: MountingHatch | null
}

export interface ScadPattern {
	type: string
	spacing_mm: number
	clip_to_body?: boolean
}

export interface ScadFeature {
	shape: 'rect' | 'circle'
	label: string
	position_mm: [number, number]
	width_mm?: number
	length_mm?: number
	diameter_mm?: number
	depth_mm?: number
	z_anchor?: string
	through_surface?: boolean
	pattern?: ScadPattern | null
}

export interface SupportBlocker {
	shape: 'rect' | 'circle'
	position_mm: [number, number]
	width_mm?: number
	length_mm?: number
	diameter_mm?: number
	height_mm: number
	z_anchor?: string
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
	scad?: { features: ScadFeature[] } | null
	support_blockers?: SupportBlocker[] | null
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
	id?: string
	name?: string
	input?: Record<string, unknown>
	tool_use_id?: string
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
