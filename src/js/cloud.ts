import { createClient, WebDAVClient } from 'webdav'
import jsyaml from 'js-yaml'
import type { Settings } from '@/types/settings'
import type { Recipe, RecipePictures, RecipeImages } from '@/types/recipe'

class CloudService {
  /**
   * Create a WebDAV client with the given settings
   */
  webdavClient(settings: Settings): WebDAVClient {
    return createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds)
  }

  /**
   * Check if the configured WebDAV path exists
   */
  checkPath(settings: Settings): Promise<boolean> {
    const client = this.webdavClient(settings)
    return client.exists(settings.webdav.filepath)
  }

  /**
   * Download and parse the cookbook.yaml file
   */
  async getRecipes(settings: Settings): Promise<string> {
    const path = this.getRootpath(settings) + 'cookbook.yaml'
    const client = this.webdavClient(settings)
    return client.getFileContents(path, { format: 'text' }) as Promise<string>
  }

  /**
   * Load all images for all recipes
   */
  async getRecipeImages(settings: Settings, recipes: Recipe[]): Promise<RecipeImages> {
    const recipe_images: RecipeImages = {}
    
    for (const recipe of recipes) {
      const images = await this.getSingleRecipeImages(settings, recipe)
      recipe_images[recipe.recipe_uuid] = images
    }
    
    return recipe_images
  }

  /**
   * Load all images for a single recipe
   */
  async getSingleRecipeImages(settings: Settings, recipe: Recipe): Promise<File[]> {
    const client = this.webdavClient(settings)
    const path = this.getRootpath(settings) + 'pictures/'
    const images: File[] = []

    return images
  }

  /**
   * Upload recipes and their images to WebDAV
   */
  async putRecipes(
    settings: Settings,
    recipes: Recipe[],
    recipe_pictures: RecipePictures
  ): Promise<void> {
    const client = this.webdavClient(settings)
    const rootpath = this.getRootpath(settings)
    const path = rootpath + 'cookbook.yaml'

    await client.putFileContents(path, jsyaml.dump(recipes))

    // Ensure pictures directory exists
    const picturesPath = rootpath + 'pictures'
    if (!(await client.exists(picturesPath))) {
      console.log('Creating pictures directory')
      await client.createDirectory(picturesPath)
    }

    // Upload images for each recipe
    for (const recipe of recipes) {
      const files = recipe_pictures[recipe.recipe_uuid]
      if (files && files.length > 0) {
        for (const file of files) {
          await this.putImageFile(settings, recipe.recipe_uuid, file)
        }
      }
    }
  }

  /**
   * Upload a single image file for a recipe
   */
  async putImageFile(settings: Settings, recipe_uuid: string, file: File): Promise<void> {
    const client = this.webdavClient(settings)
    const path = this.getRootpath(settings) + 'pictures/' + recipe_uuid

    // Create recipe directory if it doesn't exist
    if (!(await client.exists(path))) {
      await client.createDirectory(path)
    }

    const buffer = await file.arrayBuffer()
    await client.putFileContents(`${path}/${file.name}`, buffer)
  }

  /**
   * Extract the root path from the configured filepath
   */
  getRootpath(settings: Settings): string {
    const filepath = settings.webdav.filepath
    return filepath.substr(0, filepath.lastIndexOf('/') + 1)
  }
}

export default new CloudService()
