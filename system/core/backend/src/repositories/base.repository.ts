import { EDBEntity, getRandStr, getStoreItem, TBasePageEntity, TDeleteManyInput, TPagedList, TPagedParams } from '@cromwell/core';
import { ConnectionOptions, DeleteQueryBuilder, getConnection, Repository, SelectQueryBuilder } from 'typeorm';

import { getPaged, getSqlBoolStr, getSqlLike, wrapInQuotes, applyBaseFilter } from '../helpers/base-queries';
import { getLogger } from '../helpers/logger';
import { entityMetaRepository } from '../helpers/entity-meta';
import { PageStats } from '../models/entities/page-stats.entity';
import { BaseFilterInput } from '../models/filters/base-filter.filter';

const logger = getLogger();

export class BaseRepository<EntityType, EntityInputType = EntityType> extends Repository<EntityType> {

    public dbType: ConnectionOptions['type'];

    constructor(
        private EntityClass: new (...args: any[]) => EntityType & { id?: number }
    ) {
        super();
        this.dbType = getStoreItem('dbInfo')?.dbType as ConnectionOptions['type']
            ?? getConnection().options.type;
    }

    getSqlBoolStr = (b: boolean) => getSqlBoolStr(this.dbType, b);
    getSqlLike = () => getSqlLike(this.dbType);
    quote = (str: string) => wrapInQuotes(this.dbType, str);

    async getPaged(params?: TPagedParams<EntityType>): Promise<TPagedList<EntityType>> {
        logger.log('BaseRepository::getPaged');
        const qb = this.createQueryBuilder(this.metadata.tablePath);
        return await getPaged(qb, this.metadata.tablePath, params);
    }

    async getAll(): Promise<EntityType[]> {
        logger.log('BaseRepository::getAll');
        return this.find()
    }

    async getById(id: number, relations?: string[]): Promise<EntityType | undefined> {
        logger.log('BaseRepository::getById');
        const entity = await this.findOne({
            where: { id },
            relations
        });
        if (!entity) throw new Error(`${this.metadata.tablePath} ${id} not found!`);
        return entity;
    }

    async getBySlug(slug: string, relations?: string[]): Promise<EntityType | undefined> {
        logger.log('BaseRepository::getBySlug');
        const entity = await this.findOne({
            where: { slug },
            relations
        });
        if (!entity) throw new Error(`${this.metadata.tablePath} ${slug} not found!`);
        return entity;
    }

    async createEntity(input: EntityInputType, id?: number | null): Promise<EntityType> {
        logger.log('BaseRepository::createEntity');
        let entity = new this.EntityClass();
        if (id) entity.id = id;

        for (const key of Object.keys(input)) {
            entity[key] = input[key];
        }
        entity = await this.save<EntityType>(entity);
        return entity;
    }

    async updateEntity(id: number, input: EntityInputType): Promise<EntityType> {
        logger.log('BaseRepository::updateEntity');
        let entity = await this.findOne({
            where: { id }
        });
        if (!entity) throw new Error(`${this.metadata.tablePath} ${id} not found!`);

        for (const key of Object.keys(input)) {
            entity[key] = input[key];
        }
        entity = await this.save(entity);

        return entity;
    }

    async deleteEntity(id: number): Promise<boolean> {
        logger.log('BaseRepository::deleteEntity ' + this.metadata.tablePath);
        const entity = await this.getById(id);
        if (!entity) {
            logger.error(`BaseRepository::deleteEntity failed to find ${this.metadata.tablePath} ${id} by id: ${id}`);
            return false;
        }
        const res = await this.delete(id);
        return true;
    }

    async applyDeleteMany(qb: SelectQueryBuilder<EntityType> | DeleteQueryBuilder<EntityType>, input: TDeleteManyInput) {
        if (input.all) {
            if (input.ids?.length) {
                qb.andWhere(`${this.metadata.tablePath}.id NOT IN (:...ids)`, { ids: input.ids ?? [] })
            } else {
                // no WHERE needed
            }
        } else {
            if (input.ids?.length) {
                input.ids = input.ids.filter(Boolean).filter(id => typeof id === 'number');
                qb.andWhere(`${this.metadata.tablePath}.id IN (:...ids)`, { ids: input.ids ?? [] })
            } else {
                throw new Error(`applyDeleteMany: You have to specify ids to delete for ${this.metadata.tablePath}`);
            }
        }
    }

    async deleteMany(input: TDeleteManyInput) {
        logger.log('BaseRepository::deleteMany ' + this.metadata.tablePath, input);
        const qb = this.createQueryBuilder().delete().from<EntityType>(this.metadata.tablePath);
        this.applyDeleteMany(qb, input);
        await qb.execute();
        return true;
    }

    applyGetEntityViews(qb: SelectQueryBuilder<TBasePageEntity>, entityType: EDBEntity) {
        const statsTable = PageStats.getRepository().metadata.tablePath;
        const entityTypeKey = 'entityType' + getRandStr(4);
        qb.addSelect(`${statsTable}.views`, this.metadata.tablePath + '_' + 'views')
            .leftJoin(PageStats, statsTable,
                `${statsTable}.${this.quote('slug')} = ${this.metadata.tablePath}.slug ` +
                `AND ${statsTable}.${this.quote('entityType')} = :${entityTypeKey}`)
            .setParameter(entityTypeKey, entityType);
        return qb;
    }

    async getEntityViews(entityId: number, entityType: EDBEntity) {
        const qb: SelectQueryBuilder<TBasePageEntity> = this.createQueryBuilder(this.metadata.tablePath)
            .select([`${this.metadata.tablePath}.id`]) as any;

        this.applyGetEntityViews(qb, entityType)
            .where(`${this.metadata.tablePath}.id = :entityId`, { entityId });

        const entity = await qb.getRawOne();
        return entity?.[this.metadata.tablePath + '_' + 'views'];
    }

    applyBaseFilter(qb: SelectQueryBuilder<TBasePageEntity>, filter?: BaseFilterInput): SelectQueryBuilder<TBasePageEntity> {
        if (!filter) return qb;
        const entityType = entityMetaRepository.getEntityType(this.EntityClass);
        if (!entityType) return qb;
        return applyBaseFilter({ qb, filter, entityType, dbType: this.dbType });
    }

}