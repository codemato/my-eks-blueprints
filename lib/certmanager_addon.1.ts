// lib/certmanager_addon.ts
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import merge from "ts-deepmerge";
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';
import { createNamespace } from '@aws-quickstart/eks-blueprints/dist/utils/namespace-utils';
/**
 * User provided options for the Helm Chart
 */
export interface CertManagerAddOnProps extends blueprints.HelmAddOnUserProps {
  version?: string,
  installCRDs?: boolean
  createNamespace?: boolean
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & CertManagerAddOnProps = {
  name: "blueprints-cert-manager-addon",
  namespace: "cert-manager",
  chart: "cert-manager",
  version: "1.8",
  release: "cert-manager",
  repository:  "https://charts.jetstack.io",
  values: {},
  installCRDs: true, //To automatically install and manage the CRDs as part of your Helm release,
  createNamespace: true

};

/**
 * Main class to instantiate the Helm chart
 */
export class CertManagerAddOn extends blueprints.HelmAddOn {

  readonly options: CertManagerAddOnProps;

  constructor(props?: CertManagerAddOnProps) {
    super({...defaultProps, ...props});
    this.options = this.props as CertManagerAddOnProps;
  }

  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    const cluster = clusterInfo.cluster;
    
    if( this.options.createNamespace == true){
      createNamespace(this.options.namespace! , cluster);
    }
    
    let values: blueprints.Values = populateValues(this.options);
    values = merge(values, this.props.values ?? {});
    const chart = this.addHelmChart(clusterInfo, values);
    return Promise.resolve(chart);
  }
}

/**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: CertManagerAddOnProps): blueprints.Values {
  const values = helmOptions.values ?? {};
  setPath(values, "installCRDs",  helmOptions.installCRDs);
  return values;
}
