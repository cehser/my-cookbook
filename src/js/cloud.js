import { createClient } from 'webdav/web';
import jsyaml from 'js-yaml';

export default {
  webdavClient(settings) {
    return createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
  },
  checkPath(settings) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    return webdavclient.exists(settings.webdav.filepath)
  },
  getRecipes(settings) {
    let path = this.getRootpath(settings) + "cookbook.yaml"
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    return webdavclient.getFileContents(path, { format: "text" })
  },
  //TODO get images
  async getRecipeImages(settings, recipes) {
    //load images for all recipes
    let recipe_images = {}
    for await (const recipe of recipes) {
      let images = await this.getSingleRecipeImages(settings, recipe)
      recipe_images[recipe.recipe_uuid] = images
    }
    return recipe_images
  },
  async getSingleRecipeImages(settings, recipe) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    let path = this.getRootpath(settings) + "pictures/"
        
    let images = []
    
    if(recipe.cloud_images && recipe.cloud_images.length > 0) {
      //load all images for recipe
      for await(const imagename of recipe.cloud_images) {
        let image_path = path + recipe.recipe_uuid + "/" + imagename
        try {
          let buff = await webdavclient.getFileContents(image_path)
          images.push(new File([buff], imagename))
        }
        catch (e) {
          console.log(e)
        }
      }
    }
    return images
  },
  async putRecipes(settings, recipes, recipe_pictures) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    let rootpath = this.getRootpath(settings)
    let path = rootpath + "cookbook.yaml"
    
    webdavclient.putFileContents(path, jsyaml.dump(recipes))
      .then(async () => {
        if(!await webdavclient.exists(rootpath + "pictures")) {
          console.log("create pictures dir")
          await webdavclient.createDirectory(rootpath + "pictures");
        }
        
        // Upload images for each recipe
        for (const recipe of recipes) {
          if (recipe.cloud_images && recipe.cloud_images.length > 0) {
            for (const imageName of recipe.cloud_images) {
              // Check if we have this image in recipe_pictures
              if (recipe_pictures[imageName]) {
                const blob = recipe_pictures[imageName]
                // Convert Blob to File
                const file = new File([blob], imageName, { type: blob.type })
                await this.putImageFile(settings, recipe.recipe_uuid, file)
              }
            }
          }
        }
      })
  },
  async putImageFile(settings, recipe_uuid, file) {
    let webdavclient = createClient(settings.webdav.webdav_url, settings.webdav.webdav_creds);
    let path = this.getRootpath(settings) + "pictures/" + recipe_uuid

    if(!await webdavclient.exists(path)) {
      await webdavclient.createDirectory(path);
    }

    var buffer = await file.arrayBuffer();
    await webdavclient.putFileContents(path + "/" + file.name, buffer)
  },
  getRootpath(settings) {
    return settings.webdav.filepath.substr(0, settings.webdav.filepath.lastIndexOf("/")+1)
  }
}