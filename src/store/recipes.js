const jsyaml = require('js-yaml');

export default {
  new_recipe_de:  `
    ingredients: []
    steps: []
    sections: []
    recipe_name: Neues Rezept
    imageurl: /placeholder-image.png
    yields:
      - Portionen: 4
    recalc_exp: 1
  `,
  sample_recipe: `
    sections: []
    recipe_name: Neues Rezept
    imageurl: /placeholder-image.png
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
  generateUUID() { // Public Domain/MIT
    let d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
      d += performance.now(); //use high-precision timer if available
    }
    let newGuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      let r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    
    return newGuid;
  },
  initRecipe(recipe) {
    //set default values
    recipe.sections     = recipe.sections ||  [{section:""}];
    recipe.sections     = (recipe.sections.length > 0) ? recipe.sections : [{section:""}];
    recipe.steps        = recipe.steps || [];
    recipe.ingredients  = recipe.ingredients || [];
    recipe.recipe_uuid  = recipe.recipe_uuid || this.generateUUID();
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
  loadYamlRecipe: function (content) {
    return this.initRecipe(jsyaml.load(content));
  },
  // find local recipe by uuid, replace it by remote if newer
  // add remote recipe if not found locally
  mergeCoobooks(local, remote) {
    remote.forEach( remoteRecipe => {
      let localIndex  = local.findIndex(x => x.recipe_uuid === remoteRecipe.recipe_uuid);
      let localRecipe = local[localIndex];
      //replace also if remote == local to replace unsaved local changes

      console.log(localIndex);
      
      if(localIndex != -1 && !(localRecipe.lastUpdated > remoteRecipe.lastUpdated)) {
        local.splice(localIndex, 1, remoteRecipe);
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
}