import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { EstoquesService } from './estoques.service';
import { CreateEstoqueDto } from './dto/create-estoque.dto';
import { UpdateEstoqueDto } from './dto/update-estoque.dto';
import { Roles, AccessRole } from '../../common/auth/decorators/roles.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';

@Controller('estoques')
@UseGuards(AuthGuard, RolesGuard)
export class EstoquesController {
  constructor(private readonly estoquesService: EstoquesService) {}

  @Post()
  @Roles(AccessRole.ADMIN)
  create(@Body() createEstoqueDto: CreateEstoqueDto) {
    return this.estoquesService.create(createEstoqueDto);
  }

  @Get()
  findAll() {
    return this.estoquesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.estoquesService.findOne(id);
  }

  @Patch(':id')
  @Roles(AccessRole.ADMIN)
  update(@Param('id') id: string, @Body() updateEstoqueDto: UpdateEstoqueDto) {
    return this.estoquesService.update(id, updateEstoqueDto);
  }

  @Delete(':id')
  @Roles(AccessRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.estoquesService.remove(id);
  }
}