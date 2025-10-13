import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, Users, Award, Target, AlertCircle } from 'lucide-react';

const DashboardParticipants = () => {
  const [activeTab, setActiveTab] = useState('overview');
  //const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    //loadData();
    setLoading(false);
  }, []);

  // const loadData = async () => {
  //   try {
  //     const fileContent = await window.fs.readFile('Analysis PLAN Aprovados  Parceiros  APROVADOS.csv', { encoding: 'utf8' });
  //     const Papa = await import('papaparse');
      
  //     const parsed = Papa.parse(fileContent, {
  //       header: true,
  //       dynamicTyping: true,
  //       skipEmptyLines: true,
  //       delimitersToGuess: [',', '\t', '|', ';']
  //     });

  //     const cleanData = parsed.data.map(row => {
  //       const clean = {};
  //       Object.keys(row).forEach(key => {
  //         clean[key.trim()] = row[key];
  //       });
  //       return clean;
  //     });

  //     setParticipantes(cleanData);
  //     setLoading(false);
  //   } catch (error) {
  //     console.error('Erro ao carregar dados:', error);
  //     setLoading(false);
  //   }
  // };

  // Dados demográficos
  
  const demografiaData = {
    genero: [
      { name: 'Feminino', value: 331, percent: 61.5 },
      { name: 'Masculino', value: 204, percent: 37.9 },
      { name: 'Não-binário', value: 2, percent: 0.4 },
      { name: 'Prefiro não declarar', value: 1, percent: 0.2 }
    ],
    raca: [
      { name: 'Preta', value: 384, percent: 71.4 },
      { name: 'Parda', value: 138, percent: 25.7 },
      { name: 'Branca', value: 13, percent: 2.4 },
      { name: 'Indígena', value: 3, percent: 0.6 }
    ],
    senioridade: [
      { name: 'Gerente', value: 149 },
      { name: 'Coordenador', value: 116 },
      { name: 'Especialista Sr', value: 67 },
      { name: 'Diretor', value: 42 },
      { name: 'Head', value: 35 },
      { name: 'C-Level', value: 27 }
    ],
    setores: [
      { name: 'Comunicação e Marketing', value: 53 },
      { name: 'Finanças', value: 49 },
      { name: 'Recursos Humanos', value: 45 },
      { name: 'Comercial e Vendas', value: 35 },
      { name: 'Tecnologia', value: 45 },
      { name: 'Educação', value: 23 },
      { name: 'Sustentabilidade', value: 22 },
      { name: 'Saúde', value: 19 }
    ]
  };

  // Dados de Impacto
  const impactoData = [
    { categoria: 'Diversidade e Inclusão', value: 155, percent: 30.4 },
    { categoria: 'Liderança de Equipes', value: 135, percent: 26.5 },
    { categoria: 'Desenvolvimento de Produtos', value: 131, percent: 25.7 },
    { categoria: 'Projetos Sociais', value: 129, percent: 25.3 },
    { categoria: 'Transformação Digital', value: 120, percent: 23.5 },
    { categoria: 'Reestruturação/Processos', value: 111, percent: 21.8 },
    { categoria: 'Crescimento de Receita', value: 109, percent: 21.4 },
    { categoria: 'Comunicação e Marketing', value: 99, percent: 19.4 }
  ];

  // Dados de Visão de Futuro
  const visaoFuturoData = [
    { categoria: 'Cargos Executivos (C-Level)', value: 185, percent: 36.1 },
    { categoria: 'Tornar-se Referência', value: 104, percent: 20.3 },
    { categoria: 'Impacto Social', value: 84, percent: 16.4 },
    { categoria: 'Aumentar Representatividade', value: 79, percent: 15.4 },
    { categoria: 'Conselho/Consultoria', value: 63, percent: 12.3 },
    { categoria: 'Desenvolvimento de Liderança', value: 62, percent: 12.1 },
    { categoria: 'Empreender/Expandir', value: 54, percent: 10.5 },
    { categoria: 'Internacionalização', value: 48, percent: 9.4 }
  ];

  // Dados de Desafios
  const desafiosData = [
    { categoria: 'Falta de Oportunidades', value: 315, percent: 58.9 },
    { categoria: 'Falta de Networking', value: 209, percent: 39.1 },
    { categoria: 'Ambiente Organizacional', value: 185, percent: 34.6 },
    { categoria: 'Questões Financeiras', value: 102, percent: 19.1 },
    { categoria: 'Equilíbrio Vida/Trabalho', value: 81, percent: 15.1 },
    { categoria: 'Falta de Capacitação', value: 54, percent: 10.1 }
  ];

  // Dados de Radar para perfil consolidado
  const radarData = [
    { subject: 'Diversidade', A: 30.4, fullMark: 40 },
    { subject: 'Liderança', A: 26.5, fullMark: 40 },
    { subject: 'Inovação', A: 23.5, fullMark: 40 },
    { subject: 'Social', A: 25.3, fullMark: 40 },
    { subject: 'Resultados', A: 21.4, fullMark: 40 }
  ];

  const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-pink-600 text-white p-8 rounded-2xl shadow-xl">
        <div className="max-w-full">
          <h1 className="text-4xl font-bold mb-2">Dashboard de Participantes Aprovados</h1>
          <p className="text-lg opacity-90">Análise completa de 538 profissionais negros em programas de desenvolvimento executivo</p>
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <Users className="w-6 h-6 mb-2" />
              <div className="text-2xl font-bold">538</div>
              <div className="text-sm opacity-90">Participantes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <Award className="w-6 h-6 mb-2" />
              <div className="text-2xl font-bold">71.4%</div>
              <div className="text-sm opacity-90">Pessoas Pretas</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <TrendingUp className="w-6 h-6 mb-2" />
              <div className="text-2xl font-bold">48.5%</div>
              <div className="text-sm opacity-90">+15 anos carreira</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <Target className="w-6 h-6 mb-2" />
              <div className="text-2xl font-bold">36.1%</div>
              <div className="text-sm opacity-90">Buscam C-Level</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-md rounded-lg">
        <div className="px-6">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Visão Geral', icon: Users },
              { id: 'impacto', label: 'Realizações de Impacto', icon: Award },
              { id: 'futuro', label: 'Visão de Futuro', icon: Target },
              { id: 'desafios', label: 'Desafios', icon: AlertCircle }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-4 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Insights Principais */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2 text-purple-600" />
                Insights Principais
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-purple-900 mb-3">Perfil Predominante</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• <strong>97.1%</strong> pessoas negras (Pretas + Pardas)</li>
                    <li>• <strong>61.5%</strong> Mulheres</li>
                    <li>• <strong>48.5%</strong> com +15 anos de carreira</li>
                    <li>• <strong>27.7%</strong> em cargos de Gerência</li>
                    <li>• <strong>81%</strong> concentrados em SP e RJ</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">Setores de Atuação</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Comunicação e Marketing</li>
                    <li>• Finanças e Economia</li>
                    <li>• Recursos Humanos</li>
                    <li>• Comercial e Vendas</li>
                    <li>• Tecnologia da Informação</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Demographics Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Gênero */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Distribuição por Gênero</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={demografiaData.genero}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${entry.percent}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {demografiaData.genero.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Raça */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Distribuição Racial</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={demografiaData.raca}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${entry.percent}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {demografiaData.raca.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Senioridade e Setores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Senioridade */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Nível de Senioridade</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demografiaData.senioridade}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Setores */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Principais Setores</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demografiaData.setores} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ec4899" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'impacto' && (
          <div className="space-y-8">
            {/* Header de Impacto */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">Realizações de Impacto</h2>
              <p className="text-lg opacity-90">Análise de 510 narrativas profissionais que demonstram as principais conquistas e contribuições desses líderes</p>
            </div>

            {/* Radar Chart - Perfil de Impacto */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Perfil de Impacto Consolidado</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 40]} />
                  <Radar name="Impacto" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Categorias de Impacto */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Categorias de Impacto Identificadas</h3>
              <div className="space-y-4">
                {impactoData.map((item, index) => (
                  <div key={index} className="relative">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold text-gray-700">{item.categoria}</span>
                      <span className="text-purple-600 font-bold">{item.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{item.value} menções</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights de Impacto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl p-6">
                <div className="text-4xl font-bold text-purple-900 mb-2">30.4%</div>
                <h4 className="font-bold text-purple-800 mb-2">Diversidade e Inclusão</h4>
                <p className="text-sm text-purple-700">Categoria mais mencionada, demonstrando forte compromisso com a transformação racial nas organizações</p>
              </div>
              <div className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-xl p-6">
                <div className="text-4xl font-bold text-pink-900 mb-2">26.5%</div>
                <h4 className="font-bold text-pink-800 mb-2">Liderança de Equipes</h4>
                <p className="text-sm text-pink-700">Alta capacidade de gestão e desenvolvimento de times, evidenciando potencial executivo</p>
              </div>
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-6">
                <div className="text-4xl font-bold text-blue-900 mb-2">25.3%</div>
                <h4 className="font-bold text-blue-800 mb-2">Impacto Social</h4>
                <p className="text-sm text-blue-700">Forte orientação para projetos que geram valor para comunidades e sociedade</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'futuro' && (
          <div className="space-y-8">
            {/* Header de Visão */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">Visão de Futuro</h2>
              <p className="text-lg opacity-90">Análise de 513 narrativas sobre aspirações e objetivos de carreira para os próximos 5 anos</p>
            </div>

            {/* Aspirações Principais */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Objetivos de Carreira</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={visaoFuturoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="categoria" angle={-45} textAnchor="end" height={120} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="percent" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detalhamento das Aspirações */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visaoFuturoData.slice(0, 4).map((item, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-800">{item.categoria}</h4>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                      {item.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{item.value} participantes</p>
                </div>
              ))}
            </div>

            {/* Insights de Futuro */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">O Que Move Esses Profissionais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-bold text-blue-900 mb-3 text-lg">🎯 Ambição Executiva</h4>
                  <p className="text-gray-700">
                    <strong>36.1%</strong> buscam posições de C-Level ou VP, demonstrando alta ambição e preparo para assumir responsabilidades estratégicas nas organizações.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-3 text-lg">💡 Expertise e Autoridade</h4>
                  <p className="text-gray-700">
                    <strong>20.3%</strong> querem se tornar referências e especialistas em suas áreas, contribuindo com conhecimento técnico e liderança de pensamento.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-3 text-lg">🌍 Impacto e Transformação</h4>
                  <p className="text-gray-700">
                    <strong>16.4%</strong> priorizam gerar impacto social e transformar realidades, mostrando compromisso com mudanças sistêmicas.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-3 text-lg">👥 Representatividade</h4>
                  <p className="text-gray-700">
                    <strong>15.4%</strong> focam em aumentar a representatividade negra em posições de poder, abrindo caminhos para futuras gerações.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'desafios' && (
          <div className="space-y-8">
            {/* Header de Desafios */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">Desafios para Ascensão Profissional</h2>
              <p className="text-lg opacity-90">Identificação dos principais obstáculos enfrentados por 535 profissionais em suas jornadas de carreira</p>
            </div>

            {/* Desafios Principais */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Barreiras Identificadas</h3>
              <div className="space-y-4">
                {desafiosData.map((item, index) => (
                  <div key={index} className="relative">
                    <div className="flex justify-between mb-2">
                      <span className="font-semibold text-gray-700">{item.categoria}</span>
                      <span className="text-red-600 font-bold">{item.percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{item.value} menções</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Análise Crítica dos Desafios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border-l-4 border-red-500">
                <h4 className="font-bold text-red-900 mb-3 text-lg flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Desafio #1: Falta de Oportunidades
                </h4>
                <p className="text-gray-700 mb-4">
                  <strong>58.9%</strong> dos participantes citam a falta de oportunidades e visibilidade como principal obstáculo.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Implicação:</strong> Apesar de qualificados, esses profissionais não conseguem acessar posições de maior responsabilidade, evidenciando tetos de vidro nas organizações.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border-l-4 border-orange-500">
                <h4 className="font-bold text-orange-900 mb-3 text-lg flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Desafio #2: Networking Limitado
                </h4>
                <p className="text-gray-700 mb-4">
                  <strong>39.1%</strong> enfrentam dificuldades para construir conexões estratégicas.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Implicação:</strong> A falta de acesso a redes de influência limita as oportunidades de desenvolvimento e progressão de carreira.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border-l-4 border-yellow-500">
                <h4 className="font-bold text-yellow-900 mb-3 text-lg flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Desafio #3: Ambiente Organizacional
                </h4>
                <p className="text-gray-700 mb-4">
                  <strong>34.6%</strong> citam problemas relacionados à cultura e ambiente organizacional.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Implicação:</strong> Culturas corporativas não inclusivas criam barreiras invisíveis que impedem o avanço profissional.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-red-50 rounded-xl p-6 border-l-4 border-amber-500">
                <h4 className="font-bold text-amber-900 mb-3 text-lg flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Desafio #4: Remuneração
                </h4>
                <p className="text-gray-700 mb-4">
                  <strong>19.1%</strong> enfrentam questões relacionadas a baixa remuneração.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Implicação:</strong> Desigualdades salariais persistem, afetando a capacidade de investimento em desenvolvimento profissional.
                  </p>
                </div>
              </div>
            </div>

            {/* Conclusões */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">Conclusões e Oportunidades</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h4 className="font-bold text-xl mb-3">🎯 Potencial Inexplorado</h4>
                  <p className="text-sm">
                    Profissionais altamente qualificados, com média de 15+ anos de carreira, mas enfrentando barreiras sistêmicas para alcançar posições estratégicas.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h4 className="font-bold text-xl mb-3">💡 Necessidade de Programas</h4>
                  <p className="text-sm">
                    Programas de desenvolvimento como os analisados são essenciais para quebrar barreiras, criar conexões e acelerar a ascensão profissional.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h4 className="font-bold text-xl mb-3">🌟 Impacto Multiplicador</h4>
                  <p className="text-sm">
                    30.4% já atuam em Diversidade e Inclusão, demonstrando que esses profissionais são agentes de transformação em suas organizações.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                  <h4 className="font-bold text-xl mb-3">🚀 Ambição Estratégica</h4>
                  <p className="text-sm">
                    36.1% buscam C-Level, evidenciando aspiração por posições de máxima influência e capacidade de gerar mudanças sistêmicas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}</div>
    </div>
  );
};

export default DashboardParticipants;