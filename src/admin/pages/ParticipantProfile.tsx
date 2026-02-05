import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  User,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Calendar,
  Award,
  Target,
  TrendingUp,
  MessageSquare,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { SimilarParticipants } from '../components/SimilarParticipants';

export function ParticipantProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const participant = useQuery(
    api.admin.getParticipantById,
    id ? { participantId: id as Id<"participants"> } : "skip"
  );

  const profile = useQuery(
    api.admin.getParticipantProfileById,
    id ? { participantId: id as Id<"participants"> } : "skip"
  );

  if (participant === undefined || profile === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (participant === null) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/participants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Participante não encontrado</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/participants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {participant.name || 'Sem nome'}
                </CardTitle>
                {participant.cargo && (
                  <CardDescription className="text-lg mt-1">
                    {participant.cargo}
                  </CardDescription>
                )}
                {participant.empresaPrograma && (
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {participant.empresaPrograma}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {participant.programaMarca && (
                <Badge variant="default">{participant.programaMarca}</Badge>
              )}
              {participant.genero && (
                <Badge variant="secondary">{participant.genero}</Badge>
              )}
              {participant.raca && (
                <Badge variant="secondary">{participant.raca}</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Contact Information */}
          {(participant.email || participant.telefone) && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Contato
              </h3>
              <div className="space-y-2">
                {participant.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${participant.email}`} className="hover:underline">
                      {participant.email}
                    </a>
                  </div>
                )}
                {participant.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{participant.telefone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Professional Information */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Informações Profissionais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participant.setor && (
                <div>
                  <span className="text-sm text-muted-foreground">Setor</span>
                  <p className="font-medium">{participant.setor}</p>
                </div>
              )}
              {participant.empresa && (
                <div>
                  <span className="text-sm text-muted-foreground">Empresa</span>
                  <p className="font-medium">{participant.empresa}</p>
                </div>
              )}
              {participant.tipoOrganizacao && (
                <div>
                  <span className="text-sm text-muted-foreground">Tipo de Organização</span>
                  <p className="font-medium">{participant.tipoOrganizacao}</p>
                </div>
              )}
              {participant.senioridade && (
                <div>
                  <span className="text-sm text-muted-foreground">Senioridade</span>
                  <p className="font-medium">{participant.senioridade}</p>
                </div>
              )}
              {participant.annosCarreira && (
                <div>
                  <span className="text-sm text-muted-foreground">Anos de Carreira</span>
                  <p className="font-medium">{participant.annosCarreira}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Location */}
          {(participant.pais || participant.estado || participant.cidade) && (
            <>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Localização
                </h3>
                <div className="flex flex-wrap gap-4">
                  {participant.cidade && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Cidade:</span>
                      <span className="font-medium">{participant.cidade}</span>
                    </div>
                  )}
                  {participant.estado && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Estado:</span>
                      <span className="font-medium">{participant.estado}</span>
                    </div>
                  )}
                  {participant.pais && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{participant.pais}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {participant.membroConselho && (
              <Badge variant="outline" className="justify-start">
                <Award className="h-4 w-4 mr-2" />
                Membro de Conselho
              </Badge>
            )}
            {participant.mercadoFinanceiro && (
              <Badge variant="outline" className="justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Mercado Financeiro
              </Badge>
            )}
            {participant.blackSisterInLaw && (
              <Badge variant="outline" className="justify-start">
                Black Sister in Law
              </Badge>
            )}
          </div>

          {/* Programs */}
          {(participant.programasSingue || participant.programasPactua) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Programas
                </h3>
                <div className="space-y-2">
                  {participant.programasSingue && (
                    <div>
                      <span className="text-sm text-muted-foreground">Singuê:</span>
                      <p className="text-sm">{participant.programasSingue}</p>
                    </div>
                  )}
                  {participant.programasPactua && (
                    <div>
                      <span className="text-sm text-muted-foreground">Pactuá:</span>
                      <p className="text-sm">{participant.programasPactua}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Profile Information */}
      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Achievements */}
          {profile.realizacoes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Realizações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.realizacoes}</p>
              </CardContent>
            </Card>
          )}

          {/* Vision */}
          {profile.visaoFuturo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Visão de Futuro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.visaoFuturo}</p>
              </CardContent>
            </Card>
          )}

          {/* Challenges Overcome */}
          {profile.desafiosSuperados && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Desafios Superados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.desafiosSuperados}</p>
              </CardContent>
            </Card>
          )}

          {/* Current Challenges */}
          {profile.desafiosAtuais && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Desafios Atuais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.desafiosAtuais}</p>
              </CardContent>
            </Card>
          )}

          {/* Motivation */}
          {profile.motivacao && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Motivação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.motivacao}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Similar Participants */}
      {id && (
        <SimilarParticipants participantId={id as Id<"participants">} limit={5} />
      )}
    </div>
  );
}
