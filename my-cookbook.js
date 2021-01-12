/* 
   for recipes in Open Recipe Format, see
   https://open-recipe-format.readthedocs.io/en/latest/
*/
var new_recipe_de = `
ingredients: []
steps: []
sections: []
recipe_name: Neues Rezept
imageurl: ./placeholder-image.png
yields:
  - Portionen: 4
recalc_exp: 1`


var sample_recipe = `ingredients:
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
          critical_control_point: Wash hands with soap and warm water before distributing.`

function swapElements(array, index1, index2) {
  var el1 = array.splice(index1, 1, array[index2]);
  array.splice(index2, 1, el1[0]);
}

Vue.component('array-reorder-btn-group', {
  props: ['array', 'index'],
  template: `
            <div class="btn-group-vertical">
              <b-button class="btn-xs" @click="swapElements(array, index, index-1)" :disabled="index == 0"><b-icon icon="chevron-up"></b-icon></b-button>
              <b-button class="btn-xs" @click="swapElements(array, index, index+1)" :disabled="index == array.length -1"><b-icon icon="chevron-down"></b-icon></b-button>
            </div>
`   
});



Vue.component('ingredient-modal-dialog-rename', {
  model: {
    prop: 'ingredient',
  },
  props: ['ingredient', 'index', 'sections'],
  mounted() {
  	//set focus to input field when the modal dialog is being displayed
  	$('#editIngredientName'+this.index).on('shown.bs.modal',  () => {
  		$('#new-ingredient-name'+this.index).focus();
	})
  },
  methods: {
  	renameIngredient: function() {
  		var newName = $('#new-ingredient-name'+this.index).val();
  		var oldName = Object.keys(this.ingredient)[0];

      var ingredient = {};
      ingredient[newName] = this.ingredient[oldName];
      ingredient.section  = this.ingredient.section;
    	
    	this.ingredient = ingredient;
    	
    	//Update component value
    	this.$emit('update', this.ingredient);
      $('#editIngredientName'+this.index).modal('hide');
      $('#ingredient-amount-input-'+this.index).focus();
    },
  },
  template: `
  	<div class="modal-dialog" role="document">
    	<div class="modal-content">
    	  <div class="modal-header">
    	    <h5 class="modal-title" id="exampleModalLabel">Zutat umbenennen</h5>
    	    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
    	      <span aria-hidden="true">&times;</span>
    	    </button>
    	  </div>
    	  <div class="modal-body">
    	    <form>
    	      <div class="form-group">
    	        <label :for="'new-ingredient-name'+index" class="col-form-label">Neue Bezeichnung für {{Object.keys(ingredient)[0]}}</label>
    	        <input type="text" class="form-control" :id="'new-ingredient-name'+index" @keydown.enter.prevent="renameIngredient">
<!--
              <label :for="'ingredient-section'+index" class="col-form-label">Abschnitt</label>
              <b-form-select v-model="ingredient.section" :options="sections" size="sm"></b-form-select>
-->
    	      </div>
    	    </form>
    	  </div>
    	  <div class="modal-footer">
    	    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
    	    <button type="button"b class="btn btn-primary" data-dismiss="modal" @click="renameIngredient">Save changes</button>
    	  </div>
    	</div>
  	</div> 
  `
});

Vue.component('ingredient-notes-form-row', {
  model: {
    prop: 'ingredient',
  },
  props: ['ingredient', 'index'],
  methods: {
    addNote: function() {
      this.ingredient_data.notes = this.ingredient_data.notes || [];
      this.ingredient_data.notes.push('Neue Notiz');
      this.$emit('update', this.ingredient);
    }
  },
  computed: {
    ingredient_data: function() {
      return this.ingredient[Object.keys(this.ingredient)[0]];
    }
  },
  template : `
    <b-form-row> 
      <b-col offset="1" sm="1">Notizen</b-col>
      <b-col sm="10">
        <b-form-row v-for="(note, index) in ingredient_data.notes" :key="index">
          <b-col sm="8"><b-form-input v-model="ingredient_data.notes[index]"></b-form-input></b-col>
          <b-col sm="1"><b-button @click="ingredient_data.notes.splice(index, 1)"><b-icon icon="trash"></b-icon></b-button></b-col> 
        </b-form-row>
        <b-form-row>
          <b-button @click="addNote"><b-icon icon="plus"></b-icon></b-button>
        </b-form-row>
      </b-col>
    </b-form-row>
  `
});

Vue.component('ingredient-edit', {
  model: {
    prop: 'ingredient',
  },
  props: ['ingredient', 'ingredients', 'index', 'sections'],
  methods: {
    deleteIngredient() {
      this.$emit('delete');
    },
    updateIngredient(ingredient) {
      //use deep copy as wokaround to notice update of ingredient name
      this.ingredient = JSON.parse(JSON.stringify(ingredient)); 
      this.$emit('update', this.ingredient);
    }
  },
  mounted() {
    if (this.ingredient_name === 'Neue Zutat') {
      $('#editIngredientName'+this.index).modal('show');
    }
  },
  computed: {
    ingredient_data: function() {
      return this.ingredient[Object.keys(this.ingredient)[0]];
    },
    ingredient_name: function() {
      return Object.keys(this.ingredient)[0];
    }
  },
  template: `
    <div>
      <b-form-row align-v="center"> 
        <b-col sm="3" align-self="center">{{ ingredient_name }}</b-col>
        <b-col sm="1" align-self="center"><b-form-input :id="'ingredient-amount-input-'+index"  placeholder="1" min="0.001" step="0.001" type="number" v-model.number="ingredient_data.amounts[0].amount" size="sm"></b-form-input></b-col>
        <b-col sm="3" align-self="center"><b-form-input placeholder="Stück" list="ingredient-units-list" v-model="ingredient_data.amounts[0].unit" size="sm"></b-form-input></b-col>
        <b-col sm="2" align-self="center"><b-form-select v-model="ingredient.section" :options="sections" size="sm"></b-form-select></b-col>
        <b-col sm="3" align-self="center"> 

            
            <b-button @click="deleteIngredient" size="sm"><b-icon icon="trash"></b-icon></b-button> 
            <b-button v-b-toggle="'notes-ingredient-' + index" size="sm"><b-icon icon="chat-square-text" ></b-icon></b-button>
            <b-button type="button" data-toggle="modal" :data-target="'#editIngredientName'+index" size="sm"><b-icon icon="pencil"></b-icon></b-button>
            <array-reorder-btn-group :array="ingredients" :index="index"></array-reorder-btn-group>

        </b-col> 
      </b-form-row> 
      <b-collapse :id="'notes-ingredient-' + index"> 
        <ingredient-notes-form-row :ingredient="ingredient" v-on:update="updateIngredient($event);" :index="index"></ingredient-notes-form-row>
      </b-collapse>
      <div class="modal fade" :id="'editIngredientName'+index" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
        <ingredient-modal-dialog-rename :sections="sections" :ingredient="ingredient" @update="updateIngredient($event)" :index="index"></ingredient-modal-dialog-rename>
      </div>
    </div>
  `
});

Vue.component('section-ingredients-edit', {
  model: {
    prop: 'ingredients',
  },
  props: ['ingredients', 'section', 'sections'],
  template:`
    <div>
      <h3>{{ section }}</h3>
      <div v-for="(ingredient, index) in ingredients" :key="index">
        <ingredient-edit v-if="section === ingredient.section" :ingredients="ingredients" :ingredient="ingredient" :index="index" :sections="sections" @update="ingredients.splice(index,1,$event)" @delete="ingredients.splice(index, 1)"></ingredient-edit>
      </div>
    </div>
  `
});

var app = new Vue({ 
    el: '#app',
    data: {
        recipes: [{}],
        file:null, 		//used for file upload
        selected: 0,
        do_recalc: true, //enable amounts recalculation
        
        webdav: {
	        webdav_creds: {
		        username: "user",
		        password: "pass"
		    },
		    webdav_url: "https://webdav.server",
		    filepath: "/cookbook.yaml"
	    }
    },
    created() {
	    if (localStorage.getItem('recipes')) {
	      try {
	        this.loadYamlFull(localStorage.getItem('recipes'));
	      } catch(e) {
	        localStorage.removeItem('recipes');
	        this.loadSample();
	      }
	    }
	    else  {
	    	this.loadSample();
	    }
	    if (localStorage.getItem('selected')) {
	    	this.selected  = Math.min(localStorage.getItem('selected'), this.recipes.length - 1);
	    } else{}

	    if (localStorage.getItem('webdav')) {
	    	this.webdav  = JSON.parse(localStorage.getItem('webdav'));
	    } else{}
	    

      this.recipes[this.selected].sections = this.recipes[this.selected].sections || [];
	},
	mounted() {
		//do login
		document.onreadystatechange = () => { 
		    if (document.readyState == "complete") { 
		        this.webdavclient = window.WebDAV.createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
		    } 
		}
		
		document.onkeydown = (event) => {
			//ctrl + s
			if(event.ctrlKey && event.which === 83){ 
				event.preventDefault(); //do not show browser dialog
			 	this.saveToLocalStorage();
			}
		}
	    
	},
    computed: {
	 	yaml: function () {
	    	return jsyaml.dump(this.recipes[this.selected])
	  	},
		ingredient_units:  function () {
			var units = new Set(['g', 'ml', 'each']);
			var dyn_units = jsonPath(this.recipes[this.selected], 'ingredients[*].*.amounts[*].unit');
			//console.log(dyn_units);
			
			if(dyn_units) {
				dyn_units.forEach(item => units.add(item))
			}
	  		return [...units].sort(); //convert to array
	  	},
	  	recipes_list: function() {
	  		//return this.recipes.map((val,idx) => {value: idx, text: val.recipe_name});
	  		return this.recipes.map((val,idx) => ({value: idx, text: val.recipe_name}));
	  	},
      current_recipe: function() {
        return this.recipes[this.selected];
      },
	  	yields_unit: { 
	  		get() {
				if(!!this.recipes && !!(this.recipes[this.selected].yields)) {
					return Object.keys(this.recipes[this.selected].yields[0])[0];	  			
		  		} else {
		  			return 'Units'
		  		}
		  	}, set(newUnit) {
		  		if(!!this.recipes && !!(this.recipes[this.selected].yields)) {
		  			var oldUnit = Object.keys(this.recipes[this.selected].yields[0])[0];
		  			var value = this.yields_value;
		  			delete this.recipes[this.selected].yields[0][oldUnit];
		  			this.recipes[this.selected].yields[0][newUnit] = value;
		  		} 
		  	} 
	  	}  	, 
	  	yields_value: {
	  		get() {
	  			if(!!this.recipes && !!(this.recipes[this.selected].yields)) {
					return this.recipes[this.selected].yields[0][this.yields_unit];
		  		} else {
		  			return 1;
		  		}
	  		},
	  		set(val) {
				if(!!this.recipes && !!(this.recipes[this.selected].yields) && val > 0) {
					var oldVal = this.recipes[this.selected].yields[0][this.yields_unit];

					this.recipes[this.selected].yields[0][this.yields_unit] = val;
					
					if(this.do_recalc) {
						this.calcNewAmounts(oldVal); 
					}
		  		}
	  		}
	  	}
	},
	filters : {
		formatNumbers: function(value) {
			if (typeof value !== "number") {
		        return value;
		    }
			return Number(value).toLocaleString('de-DE', {
			    minimumFractionDigits: 0,
			    maximumFractionDigits: 2
			});
		}
	},
	watch: {
	    selected: function (val) {
	     	localStorage.setItem('selected', val);
	     	if(this.recipes[val]) {
	     		document.title = "Kochbuch: " + this.recipes[val].recipe_name;	
	     	}
    	}
    },
	methods: {
		saveRecipeAsFile: function () {
	    	var fileNameToSaveAs = "recipe.yaml"
	    	var textFileAsBlob = new Blob([jsyaml.dump(this.recipes[this.selected])], {type:'text/plain'}); 
	    	var downloadLink = document.createElement("a");
	    	downloadLink.download = fileNameToSaveAs;
	    	downloadLink.innerHTML = "Download File";
	    	if (window.webkitURL != null)
	    	{
	    		// Chrome allows the link to be clicked
	    		// without actually adding it to the DOM.
	    		downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
	    	}
	    	else
	    	{
	    		// Firefox requires the link to be added to the DOM
	    		// before it can be clicked.
	    		downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
	    		downloadLink.onclick = destroyClickedElement;
	    		downloadLink.style.display = "none";
	    		document.body.appendChild(downloadLink);
	    	}
	    
	    	downloadLink.click();
	    },
	    saveCookbookAsFile: function () {
	    	var fileNameToSaveAs = "cookbook.yaml"
	    	var blob = new Blob([jsyaml.dump(this.recipes)], {type:'application/octet-stream'}); 
	    	var url = window.URL.createObjectURL(blob);
	    	window.URL = window.URL || window.webkitURL;
    		

			window.location.href = url;

    		/*if (userAgent.match(/iPad/i) || userAgent.match(/iPhone/i)) { //Safari & Opera iOS
			    window.location.href = url;
			}
			else {
				var downloadLink = document.createElement("a");
		    	downloadLink.download = fileNameToSaveAs;
		    	downloadLink.innerHTML = "Download File";
				downloadLink.href = url;
	    		downloadLink.onclick = destroyClickedElement;
	    		downloadLink.style.display = "none";
	    		document.body.appendChild(downloadLink);
				downloadLink.click();	
			}*/
	    	
	    },
	    loadFromFile: function (ev) {
			const file = ev.target.files[0];
			const reader = new FileReader();
			var that = this;

			reader.onload = function(e) {
				var content = jsyaml.load(e.target.result);
				var recipes=[];

				if(!Array.isArray(content)) {
					recipes = [content];
				}
				else {
					recipes = content;
				}

				recipes.forEach( function(recipe) {
					that.appendRecipe(recipe);
				});
			};
			//reader.onload = e => console.log(e.target.result);

			reader.readAsText(file);		
	    },
	    appendRecipe: function(recipe) {
        //set default values
	    	recipe.sections     = recipe.sections ||  [{section:""}];
        recipe.sections     = (recipe.sections.length > 0) ? recipe.sections : [{section:""}];
        recipe.steps        = recipe.steps || [];
        recipe.ingredients  = recipe.ingredients || [];
        recipe.recipe_uuid  = recipe.recipe_uuid || this.generateUUID();

        recipe.ingredients.forEach(ingredient => {
          ingredient.section = ingredient.section || "";
        });

        recipe.steps.forEach(step => {
          step.section = step.section || "";
        });
        
  	    this.selected = this.recipes.push(recipe) - 1;
	    },
	    loadYamlRecipe: function (content) {
	    	var recipe = jsyaml.load(content);
	    	this.appendRecipe(recipe);
		  },
	    loadYamlFull: function (content) {
	    	var recipes = jsyaml.load(content)
        this.recipes=[];

        recipes.forEach( (recipe) => {
          this.appendRecipe(recipe);
        });	   
	    },
	    saveToLocalStorage: function () {
	    	localStorage.setItem('recipe', jsyaml.dump(this.recipes[this.selected]));
	    	localStorage.setItem('recipes', jsyaml.dump(this.recipes));
	    	$('.toast').toast('show');
	    },
	    loadSample: function (){
	    	this.loadYamlRecipe(sample_recipe);
	    },
	    newRecipe: function() {
	    	this.loadYamlRecipe(new_recipe_de);
	    },
	    copyRecipe: function (index) {
	    	//deep copy recipe
	    	var recipe = jsyaml.load(jsyaml.dump(this.recipes[this.selected]));
	    	//new uuid
	    	recipe.recipe_uuid = this.generateUUID();
	    	//load
	    	this.appendRecipe(recipe);
	    },
	    generateUUID: function() { // Public Domain/MIT
	        var d = new Date().getTime();
	        if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
	            d += performance.now(); //use high-precision timer if available
	        }
	        var newGuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
	            var r = (d + Math.random() * 16) % 16 | 0;
	            d = Math.floor(d / 16);
	            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	        });
	        
	        return newGuid;
	    },
	    calcNewAmounts: function(oldYield) {
	    	var newYield = this.yields_value;
	    	var exp=1;
	    	if(this.current_recipe.recalc_exp) {
	    		exp=this.current_recipe.recalc_exp;
	    	}
	    	//console.log(this.recipes[this.selected].ingredients);
			
			  this.current_recipe.ingredients.forEach( function(ingredient) {
          var name = Object.keys(ingredient)[0];

					if (typeof ingredient[name].amounts[0].amount == "number") {						
						ingredient[name].amounts[0].amount = ingredient[name].amounts[0].amount * Math.pow(newYield,exp)/Math.pow(oldYield,exp);
					}	
			  });
	    },
	    selectStep: function(ev) {
	    	var doHighlight=!$(ev.target).hasClass("list-group-item-primary");

        $('#steps .list-group-item').removeClass("list-group-item-primary");
	    	$(ev.target).toggleClass("list-group-item-primary", doHighlight);

        $('#ingredients .ingredients-section').removeClass("highlighted list-group-item-primary border-primary");
        $('#box-ing-'+ ev.target.dataset.section).toggleClass("highlighted list-group-item-primary border-primary", doHighlight);
	    },
	    deleteSelected: function() {
	    	this.recipes.splice(this.selected, 1);
	    	this.selected=Math.max(this.selected-1,0);
	    },
	    saveToWebDAV: function() {
	    	this.webdavclient.putFileContents(this.webdav.filepath, jsyaml.dump(this.recipes));
	    	$('.toast').toast('show');
	    },
	    loadFromWebDAV: async function() {
	    	var data = await this.webdavclient.getFileContents(this.webdav.filepath, { format: "text" });
	    	this.loadYamlFull(data);
	    },
	    saveWebDAVConfig: function () {
	    	localStorage.setItem('webdav', JSON.stringify(this.webdav));
	    	this.webdavclient = window.WebDAV.createClient(this.webdav.webdav_url, this.webdav.webdav_creds);
  		},
  		addIngredient: function() {
  			this.current_recipe.ingredients.push({'Neue Zutat':{amounts:[{amount: null,unit:''}]},section:""});
  		}
	}
});

