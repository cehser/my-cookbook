import { VuexModule, Module, Mutation, } from 'vuex-module-decorators'

@Module({
  namespaced: true
})
export default class Favorites extends VuexModule {
  public favorites: any= {Favoriten:["5e89e581-0d0a-4eec-a901-c08632c10135", "79714305-b0fd-44a7-87b9-c56d3ac8e3fc"]}

  @Mutation
  setFavorites (data: {list :string, favorites:Array<string>}) {
    this.favorites[data.list] = data.favorites
  }
}