// lib/pipeline.ts
/**
 * @Author Renjith Pillai
 * */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { CapacityType, KubernetesVersion, NodegroupAmiType } from 'aws-cdk-lib/aws-eks';
import { InstanceType } from 'aws-cdk-lib/aws-ec2';
import { TeamPlatform, TeamApplication } from '../teams'; // HERE WE IMPORT TEAMS
import { CertManagerAddOn } from '../lib/certmanager_addon';
//import { KedaAddOnProps } from '../lib/keda_addon';
import { AWSPrivateCAIssuerAddon } from '../lib/aws_privateca_issuer';



export default class PipelineConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps){
    super(scope,id)
    const clusterProvider = new blueprints.GenericClusterProvider({
        version: KubernetesVersion.V1_21,
        managedNodeGroups: [
            {
                id: "mng1",
                amiType: NodegroupAmiType.AL2_X86_64,
                instanceTypes: [new InstanceType('m5.2xlarge')],
                diskSize: 25,
                nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }
            },
            {
                id: "mng2",
                amiType: NodegroupAmiType.AL2_X86_64,
                instanceTypes: [new InstanceType('m5.2xlarge')],
                diskSize: 25,
                nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }
            },
            {
                id: "mng3",
                amiType: NodegroupAmiType.AL2_X86_64,
                instanceTypes: [new InstanceType('m5.2xlarge')],
                diskSize: 25,
                nodeGroupSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }
            },
        ]
    });    
    const istioControlPlaneAddOnProps = {
      values: {
        pilot: {
          autoscaleEnabled: true,
          autoscaleMin: 1,
          autoscaleMax: 5,
          replicaCount: 1,
          rollingMaxSurge: "100%",
          rollingMaxUnavailable: "25%",
          resources: {
            requests: {
              cpu: "500m",
              memory: "2048Mi",
            }
          }
        }
      }
    }   
    const account = props?.env?.account!;
    const region = props?.env?.region!;
    const awsPcaParams = {
	    irsaRoles: ["AWSCertificateManagerPrivateCAFullAccess"]
    }
    const blueprint = blueprints.EksBlueprint.builder()
    .account(account)
    .region(region)
    .addOns(
      new blueprints.ClusterAutoScalerAddOn,
      new blueprints.KubeviousAddOn(), // New addon goes here
      new blueprints.IstioBaseAddOn(),
      new blueprints.IstioControlPlaneAddOn(istioControlPlaneAddOnProps),
      new CertManagerAddOn(),
      new AWSPrivateCAIssuerAddon(awsPcaParams)
      
    ) 
    .clusterProvider(clusterProvider)    
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
