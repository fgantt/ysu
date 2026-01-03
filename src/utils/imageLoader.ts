/**
 * Utility functions for dynamically loading wallpaper and board images
 * Uses Tauri commands to read directories at runtime, allowing users to add their own images
 */

/**
 * Filters image paths by allowed extensions
 * @param paths - Array of image paths
 * @param extensions - Array of file extensions to include (e.g., ['jpg', 'png', 'svg', 'jpeg', 'webp'])
 * @returns Filtered array of image paths
 */
function filterByExtensions(
  paths: string[],
  extensions: string[]
): string[] {
  const allowedExtensions = new Set(extensions.map(ext => ext.toLowerCase()));
  
  return paths.filter(path => {
    const extension = path.split('.').pop()?.toLowerCase();
    return extension && allowedExtensions.has(extension);
  });
}

/**
 * Check if Tauri is available
 */
async function isTauriAvailable(): Promise<boolean> {
  try {
    // Check if window.__TAURI__ exists (Tauri runtime indicator)
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return true;
    }
    // Also try to import - if it fails, we're not in Tauri
    await import('@tauri-apps/api/core');
    return true;
  } catch {
    return false;
  }
}

/**
 * Load images using Tauri command
 */
async function loadImagesViaTauri(directory: string): Promise<string[]> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const images = await invoke<string[]>('list_image_files', { directory });
    console.log(`Loaded ${images.length} images from ${directory} via Tauri`);
    return images;
  } catch (error) {
    console.error(`Error loading ${directory} images via Tauri:`, error);
    throw error;
  }
}

/**
 * Load images by fetching a directory listing (for browser-only development)
 * This is a fallback when Tauri is not available
 */
async function loadImagesViaFetch(directory: string): Promise<string[]> {
  // In browser-only mode, we can't list files, so we return empty
  // The images will still be accessible via their known paths if referenced directly
  console.warn(`Cannot list ${directory} files in browser-only mode. Tauri is required for dynamic image discovery.`);
  return [];
}

/**
 * Loads all wallpaper images from the /wallpapers directory
 * Reads from bundled resources, user data directory, and development public directory
 * @returns Promise<string[]> - Array of wallpaper image paths
 */
export async function loadWallpaperImages(): Promise<string[]> {
  try {
    let wallpapers: string[] = [];
    
    // Try Tauri first
    if (await isTauriAvailable()) {
      wallpapers = await loadImagesViaTauri('wallpapers');
    } else {
      // Fallback for browser-only development
      wallpapers = await loadImagesViaFetch('wallpapers');
    }
    
    // Filter by allowed extensions for wallpapers
    return filterByExtensions(wallpapers, ['jpg', 'png', 'svg', 'jpeg']);
  } catch (error) {
    console.error('Error loading wallpaper images:', error);
    return [];
  }
}

/**
 * Loads all board images from the /boards directory
 * Reads from bundled resources, user data directory, and development public directory
 * @returns Promise<string[]> - Array of board image paths
 */
export async function loadBoardImages(): Promise<string[]> {
  try {
    let boards: string[] = [];
    
    // Try Tauri first
    if (await isTauriAvailable()) {
      boards = await loadImagesViaTauri('boards');
    } else {
      // Fallback for browser-only development
      boards = await loadImagesViaFetch('boards');
    }
    
    // Filter by allowed extensions for boards
    return filterByExtensions(boards, ['jpg', 'png', 'svg', 'jpeg', 'webp']);
  } catch (error) {
    console.error('Error loading board images:', error);
    return [];
  }
}

/**
 * @deprecated Fallback functions are no longer needed - images are loaded dynamically at runtime
 * These are kept for backward compatibility but should not be used
 */
export function getFallbackWallpaperImages(): string[] {
  console.warn('getFallbackWallpaperImages() is deprecated - images are now loaded dynamically');
  return [];
}

export function getFallbackBoardImages(): string[] {
  console.warn('getFallbackBoardImages() is deprecated - images are now loaded dynamically');
  return [];
}
