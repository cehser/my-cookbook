/* 
   for recipes in Open Recipe Format, see
   https://open-recipe-format.readthedocs.io/en/latest/
*/

var yaml_data = `ingredients:
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
        file: null
    },
    mounted() {
	    if (localStorage.getItem('recipe')) {
	      try {
	        this.loadYaml(localStorage.getItem('recipe'));
	      } catch(e) {
	        localStorage.removeItem('recipe');
	        this.loadSample();
	      }
	    } 
	    else  {
	    	this.loadSample();
	    }
	},
    computed: {
	 	yaml: function () {
	    	return jsyaml.dump(this.recipes[0])
	  	},
		ingredient_units:  function () {
			var units = new Set(['g', 'ml', 'each']);
			var dyn_units = jsonPath(this, 'ingredients[*].*.amounts[*].unit');
			console.log(dyn_units);
			
			if(dyn_units) {
				dyn_units.forEach(item => units.add(item))
			}
	  		return [...units].sort(); //convert to array
	  	}
	},
	methods: {
		saveRecipeAsFile: function () {
	    	var fileNameToSaveAs = "recipe.yaml"
	    	var textFileAsBlob = new Blob([jsyaml.dump(this.recipes[0])], {type:'text/plain'}); 
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
	    loadFromFile: function (ev) {
			const file = ev.target.files[0];
			const reader = new FileReader();

			reader.onload = e => this.loadYaml(e.target.result);
			//reader.onload = e => console.log(e.target.result);

			reader.readAsText(file);		
	    },
	    loadYaml: function (content) {
	    	var recipe = jsyaml.load(content)
	    	this.recipes = [recipe];
	    },
	    saveToLocalStorage: function () {
	    	localStorage.setItem('recipe', jsyaml.dump(this.recipes[0]));
	    },
	    loadSample: function (){
	    	this.loadYaml(yaml_data);
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
	    }
	}
});
