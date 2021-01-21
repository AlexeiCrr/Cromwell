import { TPagedList, TProduct, TProductCategory, GraphQLPaths } from '@cromwell/core';
import {
    CreateProductCategory,
    PagedParamsInput,
    PagedProduct,
    ProductCategory,
    ProductCategoryRepository,
    ProductRepository,
    UpdateProductCategory,
} from '@cromwell/core-backend';
import { Arg, FieldResolver, Mutation, Query, Resolver, Root } from 'type-graphql';
import { getCustomRepository } from 'typeorm';

const getOneBySlugPath = GraphQLPaths.ProductCategory.getOneBySlug;
const getOneByIdPath = GraphQLPaths.ProductCategory.getOneById;
const getManyPath = GraphQLPaths.ProductCategory.getMany;
const createPath = GraphQLPaths.ProductCategory.create;
const updatePath = GraphQLPaths.ProductCategory.update;
const deletePath = GraphQLPaths.ProductCategory.delete;

const productsKey: keyof TProductCategory = 'products';

@Resolver(ProductCategory)
export class ProductCategoryResolver {

    private repository = getCustomRepository(ProductCategoryRepository)
    private productRepository = getCustomRepository(ProductRepository)

    @Query(() => [ProductCategory])
    async [getManyPath](@Arg("pagedParams") pagedParams: PagedParamsInput<TProductCategory>) {
        return await this.repository.getProductCategories(pagedParams);
    }

    @Query(() => ProductCategory)
    async [getOneBySlugPath](@Arg("slug") slug: string) {
        return await this.repository.getProductCategoryBySlug(slug);
    }

    @Query(() => ProductCategory)
    async [getOneByIdPath](@Arg("id") id: string) {
        return await this.repository.getProductCategoryById(id);
    }

    @Mutation(() => ProductCategory)
    async [createPath](@Arg("data") data: CreateProductCategory) {
        return await this.repository.createProductCategory(data);
    }

    @Mutation(() => ProductCategory)
    async [updatePath](@Arg("id") id: string, @Arg("data") data: UpdateProductCategory) {
        return await this.repository.updateProductCategory(id, data);
    }

    @Mutation(() => Boolean)
    async [deletePath](@Arg("id") id: string) {
        return await this.repository.deleteProductCategory(id);
    }

    @FieldResolver(() => PagedProduct)
    async [productsKey](@Root() productCategory: ProductCategory, @Arg("pagedParams") pagedParams: PagedParamsInput<TProduct>): Promise<TPagedList<TProduct>> {
        return await this.productRepository.getProductsFromCategory(productCategory.id, pagedParams);
    }


    @FieldResolver()
    views(): number {
        return Math.floor(Math.random() * 10);
    }
}