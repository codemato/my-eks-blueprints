// lib/kubevious_addon.ts
import { Construct } from 'constructs';
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import merge from "ts-deepmerge";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { dependable } from '@aws-quickstart/eks-blueprints/dist/utils/';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';
import { ClusterInfo, Values } from "@aws-quickstart/eks-blueprints/dist/spi";
import { createNamespace } from '@aws-quickstart/eks-blueprints/dist/utils/namespace-utils';
import { CertManagerAddOn } from '../lib/certmanager_addon';
/**
 * User provided options for the Helm Chart
 */
export interface ACMPrivateCAIssuerAddonProps extends blueprints.HelmAddOnUserProps {
    /**
     * Specifies whether a service account should be created
     */
    createServiceAccount?: boolean;
    /**
     * The name of the service account to use. If createServiceAccount is true, a serviceAccountName is generated.
     */
    serviceAccountName?: string;
    
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & ACMPrivateCAIssuerAddonProps = {
  name: "blueprints-aws-pca-issuer-addon",
  chart: "awspca/aws-privateca-issuer",
  namespace:"aws-pca-issuer",
  version: "1.2.2",
  release: "aws-pca-issuer",
  repository:  "https://cert-manager.github.io/aws-privateca-issuer",
  values: {},
  createServiceAccount: false,
  serviceAccountName: "aws-pca-issuer",

};

/**
 * Main class to instantiate the Helm chart
 */
export class ACMPrivateCAIssuerAddon extends blueprints.HelmAddOn {

  readonly options: ACMPrivateCAIssuerAddonProps;

  constructor(props?: ACMPrivateCAIssuerAddonProps) {
    super({...defaultProps, ...props});
    this.options = this.props as ACMPrivateCAIssuerAddonProps;
  }

  @dependable('CertManagerAddOn')
  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    //Create Service Account with IRSA
    const cluster = clusterInfo.cluster;
    let values: Values = populateValues(this.options);
    values = merge(values, this.props.values ?? {});
    
    if (this.options.createServiceAccount === false ) {
      //Create Service Account with IRSA
      const opts = { name: this.options.serviceAccountName, namespace: this.options.namespace };
      const sa = cluster.addServiceAccount(this.options.serviceAccountName!, opts);
      const acmPCAPolicy = ManagedPolicy.fromAwsManagedPolicyName("AWSCertificateManagerPrivateCAFullAccess");
      sa.role.addManagedPolicy(acmPCAPolicy);
      
      const namespace = createNamespace(this.options.namespace! , cluster);
      sa.node.addDependency(namespace);
      
      const chart = this.addHelmChart(clusterInfo, values);
      chart.node.addDependency(sa);
      return Promise.resolve(chart);

    } else {
      //Let aws-pca-issuer Create Service account for you. This is controlled by flag helmOptions.createServiceAccount 
      const chart = this.addHelmChart(clusterInfo, values);
      return Promise.resolve(chart);
    }
   
    
  }
}

/**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: ACMPrivateCAIssuerAddonProps): blueprints.Values {
  const values = helmOptions.values ?? {};

  setPath(values, "serviceAccount.create",  helmOptions.createServiceAccount); 
  setPath(values, "serviceAccount.name",  helmOptions.serviceAccountName); 

  return values;
}


