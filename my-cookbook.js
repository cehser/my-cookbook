/* 
   for recipes in Open Recipe Format, see
   https://open-recipe-format.readthedocs.io/en/latest/
*/
var new_recipe_de = `
ingredients: []
steps: []
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

var app = new Vue({ 
    el: '#app',
    data: {
        recipes: [{}],
        file: null,
        selected: 0,
        do_recalc: true //enable amounts recalculation
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
				if(!!this.recipes && !!(this.recipes[this.selected].yields)) {
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
	    	var blob = new Blob([jsyaml.dump(this.recipes)], {type:'text/plain'}); 
	    	window.URL = window.URL || window.webkitURL;
    		
    		if (userAgent.match(/iPad/i) || userAgent.match(/iPhone/i)) { //Safari & Opera iOS
			  var url = $window.URL.createObjectURL(blob);
			  window.location.href = url;
			}
			else {
				var downloadLink = document.createElement("a");
		    	downloadLink.download = fileNameToSaveAs;
		    	downloadLink.innerHTML = "Download File";
				downloadLink.href = window.URL.createObjectURL(blob);
	    		downloadLink.onclick = destroyClickedElement;
	    		downloadLink.style.display = "none";
	    		document.body.appendChild(downloadLink);
				downloadLink.click();	
			}
	    	
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
	    	if(!recipe.recipe_uuid) {
				recipe.recipe_uuid = this.generateUUID();
			}
	    	this.selected = this.recipes.push(recipe) - 1;
	    },
	    loadYamlRecipe: function (content) {
	    	var recipe = jsyaml.load(content);
	    	this.appendRecipe(recipe);
		},
	    loadYamlFull: function (content) {
	    	var recipes = jsyaml.load(content)
	    	this.recipes = recipes;
	    },
	    saveToLocalStorage: function () {
	    	localStorage.setItem('recipe', jsyaml.dump(this.recipes[this.selected]));
	    	localStorage.setItem('recipes', jsyaml.dump(this.recipes));
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
	    	if(this.recipes[this.selected].recalc_exp) {
	    		exp=this.recipes[this.selected].recalc_exp;
	    	}
	    	//console.log(this.recipes[this.selected].ingredients);
			
			this.recipes[this.selected].ingredients.forEach( function(ingredient) {
				Object.entries(ingredient).forEach(entry => {
					const [key, value] = entry;
					if (typeof value.amounts[0].amount == "number") {						
						value.amounts[0].amount = value.amounts[0].amount * Math.pow(newYield,exp)/Math.pow(oldYield,exp);
					}
				});
			});
	    },
	    selectStep: function(ev) {
	    	$('#steps .list-group-item').removeClass("active");
	    	ev.target.classList.add("active");
	    },
	    deleteSelected: function() {
	    	this.recipes.splice(this.selected, 1);
	    	this.selected=Math.max(this.selected-1,0);
	    },
	    renameIngredient: function(index, newName) {
	    	var oldName = Object.keys(this.recipes[this.selected].ingredients[index])[0];
	    	var newItem = {};
	    	newItem[newName] = this.recipes[this.selected].ingredients[index][oldName];

	    	this.recipes[this.selected].ingredients.splice(index, 1, newItem)
	    }

	}
});
