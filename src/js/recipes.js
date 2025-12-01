import jsyaml from 'js-yaml';
import UUID from './uuid'

export default {
  new_recipe_de:  `
    ingredients: []
    steps: []
    sections: []
    recipe_name: Neues Rezept
    imageurl: 
    yields:
      - Portionen: 4
    recalc_exp: 1
  `,
  sample_recipe: `
    sections: []
    recipe_name: Beispiel
    imageurl: 
    yields:
      - Portionen: 4
    ingredients:
      - apple:
          usda_num: 09003
          amounts:
              - amount: 1
                unit: each
          processing:
              - whole
              - raw
          substitutions:
              - pears:
                  usda_num: 09252
                  amounts:
                      - amount: 1
                        unit: each
          notes:
              - Use whole apples
              - Apples may be substituted, but produce a different flavor and mouthfeel
      - pear:
          usda_num: 09003
          amounts:
              - amount: 1
                unit: each
          processing:
              - whole
              - raw
          substitutions:
              - pears:
                  usda_num: 09252
                  amounts:
                      - amount: 1
                        unit: each
          notes:
              - Use whole pears
              - Pears may be substituted, but produce a different flavor and mouthfeel
    steps:
      - step:
            Gather the apples.
        haccp:
            control_point: The apples must be clean
        notes:
            - Some people like green
            - Some people like red
      - step:
            Hand out the apples.
        haccp:
            critical_control_point: Wash hands with soap and warm water before distributing.
  `
  ,
  initRecipe(recipe) {
    //set default values
    recipe.sections     = recipe.sections ||  [{section:""}];
    recipe.sections     = (recipe.sections.length > 0) ? recipe.sections : [{section:""}];
    recipe.steps        = recipe.steps || [];
    recipe.ingredients  = recipe.ingredients || [];
    recipe.recipe_uuid  = recipe.recipe_uuid || UUID.generateUUID();
    recipe.lastUpdated  = recipe.lastUpdated || new Date();

    recipe.ingredients.forEach(ingredient => {
      ingredient.section = ingredient.section || "";
    });

    recipe.steps.forEach(step => {
      step.section = step.section || "";
    });

    return recipe;
  },
  loadYamlCookbook: function(content) {
    let recipes = jsyaml.load(content);
    recipes.forEach( recipe => {this.initRecipe(recipe)});
    return recipes;
  },
  loadSample: function (){
    return this.loadYamlRecipe(this.sample_recipe);
  },
  loadNewRecipe: function() {
    return this.loadYamlRecipe(this.new_recipe_de);
  },
  loadYamlRecipe: function (content) {
    return this.initRecipe(jsyaml.load(content));
  },
  // find local recipe by uuid, replace it by remote if newer
  // add remote recipe if not found locally
  mergeCoobooks(local, remote, dispatch) {
    remote.forEach( remoteRecipe => {
      let localIndex  = local.findIndex(x => x.recipe_uuid === remoteRecipe.recipe_uuid);
      let localRecipe = local[localIndex];
      //replace also if remote == local to replace unsaved local changes

      console.log(localIndex);
      
      if(localIndex != -1 && !(localRecipe.lastUpdated > remoteRecipe.lastUpdated)) {
        local.splice(localIndex, 1, remoteRecipe);
        dispatch('downloadSingleRecipePictures', {recipe: remoteRecipe})
        console.log(localRecipe.lastUpdated);
        console.log(remoteRecipe.lastUpdated);
        console.log('Local not newer: ' + !(localRecipe.lastUpdated > remoteRecipe.lastUpdated));
        console.log('Local replaced');
      }
      else if(localIndex === -1) {
        console.log('remote pushed');
        local.push(remoteRecipe);
      }
      
    });
    return local;
  },
  filesEqual(file1, file2) {
    return (file1.name === file2.name && file1.lastModifiedDate === file2.lastModifiedDate && file1.size === file2.size)
  }
}