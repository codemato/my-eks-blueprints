// lib/pipeline.ts
/**
 * @Author Renjith Pillai
 * */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { TeamPlatform, TeamApplication } from '../teams'; // HERE WE IMPORT TEAMS
import { KedaAddOn } from '../lib/keda_addon';
//import { KedaAddOnProps } from '../lib/keda_addon';


export default class PipelineConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps){
    super(scope,id)

    const account = props?.env?.account!;
    const region = props?.env?.region!;
    const blueprint = blueprints.EksBlueprint.builder()
    .account(account)
    .region(region)
    .addOns(
      new blueprints.ClusterAutoScalerAddOn,
      new blueprints.KubeviousAddOn(), // New addon goes here
      new KedaAddOn({podSecurityContextFsGroup: 1001, securityContextRunAsGroup: 1001, securityContextRunAsUser: 1001, irsaRoles:["CloudWatchFullAccess","AmazonSQSFullAccess"] })
    ) 
    .teams(new TeamPlatform(account), new TeamApplication('amway',account));
         // HERE WE ADD THE ARGOCD APP OF APPS REPO INFORMATION
    const repoUrl = 'https://github.com/codemato/cdk-eks-argo-workload.git';

    const bootstrapRepo : blueprints.ApplicationRepository = {
        repoUrl,
        targetRevision: 'main',
    }

    // HERE WE GENERATE THE ADDON CONFIGURATIONS
    const devBootstrapArgo = new blueprints.ArgoCDAddOn({
        bootstrapRepo: {
            ...bootstrapRepo,
            path: 'envs/dev'
        },
    });
    const testBootstrapArgo = new blueprints.ArgoCDAddOn({
        bootstrapRepo: {
            ...bootstrapRepo,
            path: 'envs/test'
        },
    });
    const prodBootstrapArgo = new blueprints.ArgoCDAddOn({
        bootstrapRepo: {
            ...bootstrapRepo,
            path: 'envs/prod'
        },
    });
    
    blueprints.CodePipelineStack.builder()
      .name("eks-blueprints-workshop-pipeline")
      .owner("codemato")
      .repository({
          repoUrl: 'my-eks-blueprints',
          credentialsSecretName: 'github-token-new',
          targetRevision: 'main'
      })
            // WE ADD THE STAGES IN WAVE FROM THE PREVIOUS CODE
      .wave({
        id: "envs",
        stages: [
          { id: "dev", stackBuilder: blueprint.clone('us-west-2').addOns(devBootstrapArgo)},
          { id: "test", stackBuilder: blueprint.clone('us-east-2').addOns(testBootstrapArgo)},
          { id: "prod", stackBuilder: blueprint.clone('us-west-1').addOns(prodBootstrapArgo)}
        ]
      })
      .build(scope, id+'-stack', props);
  }
}
