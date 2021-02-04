import jsyaml from 'js-yaml'

export default { 
  deepCopyYaml(src) {
    return jsyaml.load(jsyaml.dump(src));
  },
  deepCopyJSON(src) {
    return JSON.parse(JSON.stringify(src))
  }

}