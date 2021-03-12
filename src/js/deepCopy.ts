import _ from 'lodash'

export default { 
  deepCopyYaml(src:any) {
    return _.cloneDeep(src)
  },
  deepCopyJSON(src:any) {
    return _.cloneDeep(src)
  }
}