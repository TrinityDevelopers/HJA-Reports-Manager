import type {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';

export class BaseCrudService<T extends { id: string }> {
  protected repository: Repository<T>;

  constructor(repository: Repository<T>) {
    this.repository = repository;
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  async findById(id: string, options?: Omit<FindOneOptions<T>, 'where'>) {
    const where = { id } as unknown as FindOptionsWhere<T>;
    return await this.repository.findOne({ ...(options ?? {}), where });
  }

  async update(id: string, data: DeepPartial<T>, findOptions?: Omit<FindOneOptions<T>, 'where'>) {
    await this.repository.update(id, data as QueryDeepPartialEntity<T>);
    return await this.findById(id, findOptions);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
