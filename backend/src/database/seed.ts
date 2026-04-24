import { AppDataSource } from './connection';
import { ProjectService } from '../services/ProjectService';
import { TemplateService } from '../services/TemplateService';
import { ReportService } from '../services/ReportService';
import { Location } from '../entities/Location';

async function seedDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const projectService = new ProjectService();
    const templateService = new TemplateService();
    const reportService = new ReportService();

    // Seed templates
    await templateService.seedDefaultTemplates();
    console.log('✓ Templates seeded');

    // Seed sample project
    const project = await projectService.create({
      projectName: 'Sample Highway Project',
      projectNumber: 'HWY-2024-001',
      description: 'Sample project for testing',
      locations: [
        {
          name: 'Site A - Mile Marker 5',
          description: 'First testing location',
        },
        {
          name: 'Site B - Mile Marker 10',
          description: 'Second testing location',
        },
      ] as Partial<Location>[],
    });
    console.log('✓ Sample project created:', project.id);

    // Get templates
    const templates = await templateService.findAll();
    const proctorTemplate = templates.find((t) => t.name === 'standard-proctor');

    if (!proctorTemplate) {
      throw new Error('Proctor template not found');
    }

    // Create sample report
    const report = await reportService.create({
      projectId: project.id,
      templateId: proctorTemplate.id,
      dateOfTest: new Date('2024-01-15'),
      headerData: {
        dateDroppedOff: '2024-01-16',
        droppedOffBy: 'John Smith',
        labCode: 'LAB-001',
        sampleLocation: 'Site A - Mile Marker 5',
        materialDescription: 'Clay and Sand Mix',
        methodUsed: 'A',
        specificGravity: '2.65',
        sampleNumber: 'S-001',
        testNumber: 'T-001',
        scaleNumber: 'SC-001',
        moldSize: '4',
        weightOfMold: '1420',
        ovenNumber: 'OV-001',
      },
    });
    console.log('✓ Sample report created:', report.id);

    // Add sample entries
    const entryData = [
      {
        estimatedMoisture: 8,
        weightOfMoldSpecimen: 2100,
        wetWeightOfSpecimen: 115.2,
        dryWeightOfSpecimen: 106.5,
        dryDensityWhenMolded: 114.8,
        panNumber: 'P-001',
        panWeight: 12.5,
        moisturePercentage: 8.2,
      },
      {
        estimatedMoisture: 10,
        weightOfMoldSpecimen: 2150,
        wetWeightOfSpecimen: 117.5,
        dryWeightOfSpecimen: 107.8,
        dryDensityWhenMolded: 116.2,
        panNumber: 'P-002',
        panWeight: 12.5,
        moisturePercentage: 9.0,
      },
      {
        estimatedMoisture: 12,
        weightOfMoldSpecimen: 2180,
        wetWeightOfSpecimen: 119.2,
        dryWeightOfSpecimen: 108.5,
        dryDensityWhenMolded: 117.1,
        panNumber: 'P-003',
        panWeight: 12.5,
        moisturePercentage: 10.1,
      },
    ];

    for (let i = 0; i < entryData.length; i++) {
      await reportService.addEntry(report.id, {
        data: entryData[i],
        entryOrder: i,
      });
    }
    console.log('✓ Sample entries created');

    console.log('\n✓ Database seeding complete!');
    console.log('\nSample Data:');
    console.log(`- Project: ${project.projectName} (${project.id})`);
    console.log(`- Report: ${report.id}`);
    console.log(`- Entries: ${entryData.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
