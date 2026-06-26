import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'plan_items' })
export class PlanItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: 'table' | 'column' | 'label';

  @Column({ type: 'int' })
  x!: number;

  @Column({ type: 'int' })
  y!: number;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'varchar', length: 120, default: '' })
  text!: string;

  @Column({ type: 'int', nullable: true })
  tableNumber!: number | null;

  @Column({ type: 'int', nullable: true })
  roomNumber!: number | null;
}