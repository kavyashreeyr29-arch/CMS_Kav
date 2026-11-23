import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTestCaseDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  steps?: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;
}

export class UpdateTestCaseDto {
  @IsOptional()
  @IsIn(['pending', 'pass', 'fail', 'blocked'])
  status?: 'pending' | 'pass' | 'fail' | 'blocked';

  @IsOptional()
  @IsBoolean()
  regressionFlag?: boolean;
}
