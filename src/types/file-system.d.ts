interface FileSystemWritableFileStream extends WritableStream {
	write(data: string | BufferSource | Blob): Promise<void>
	close(): Promise<void>
}

interface FileSystemFileHandle {
	createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle {
	getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
	getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
}

declare global {
	interface Window {
		showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
	}
}

export {}
