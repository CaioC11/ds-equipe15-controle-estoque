import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AccessRole, Roles } from '../../common/auth/decorators/roles.decorator';
import { AuthGuard } from '../../common/auth/guards/auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { AutorizarGestorDto } from './dto/autorizar-gestor.dto';
import { CreateEstoqueDto } from './dto/create-estoque.dto';
import { UpdateEstoqueDto } from './dto/update-estoque.dto';
import { EstoquesService } from './estoques.service';

@Controller('estoques')
@ApiTags('Estoques')
@ApiBearerAuth()
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

  @Get(':id/gestores')
  @Roles(AccessRole.ADMIN)
  @ApiOperation({ summary: 'Lista os gestores autorizados para um estoque (ADMIN)' })
  @ApiParam({ name: 'id', description: 'ID do estoque' })
  listGestores(@Param('id') id: string) {
    return this.estoquesService.listGestores(id);
  }

  @Post(':id/gestores')
  @Roles(AccessRole.ADMIN)
  @ApiOperation({ summary: 'Autoriza um usuário como gestor de um estoque (ADMIN)' })
  @ApiParam({ name: 'id', description: 'ID do estoque' })
  @ApiBody({
    type: AutorizarGestorDto,
    examples: { exemplo: { value: { usuarioId: 'sub-do-usuario-no-keycloak' } } },
  })
  addGestor(@Param('id') id: string, @Body() dto: AutorizarGestorDto) {
    return this.estoquesService.addGestor(id, dto.usuarioId);
  }

  @Delete(':id/gestores/:usuarioId')
  @Roles(AccessRole.ADMIN)
  @ApiOperation({ summary: 'Remove a autorização de gestor de um usuário (ADMIN)' })
  @ApiParam({ name: 'id', description: 'ID do estoque' })
  @ApiParam({ name: 'usuarioId', description: 'Claim sub do usuário no Keycloak' })
  removeGestor(@Param('id') id: string, @Param('usuarioId') usuarioId: string) {
    return this.estoquesService.removeGestor(id, usuarioId);
  }
}
